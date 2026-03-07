'use server';

import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { passwordSchema } from '@/lib/schemas/auth';
import { sendPasswordResetEmail } from '@/lib/services/emailService';
import { logger } from '@/lib/utils/logger';

const MAX_RESET_ATTEMPTS = 3;
const RATE_LIMIT_WINDOW_HOURS = 1;

function getSiteUrl(): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://houseproshub.com';
  return siteUrl.replace(/\/$/, '');
}

async function checkRateLimit(email: string): Promise<{ allowed: boolean; error?: string }> {
  try {
    const admin = createServiceRoleClient();
    await admin.rpc('cleanup_expired_password_reset_attempts');
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - RATE_LIMIT_WINDOW_HOURS);
    const { data: attempts, error: countError } = await admin
      .from('password_reset_attempts')
      .select('id', { count: 'exact' })
      .eq('email', email.toLowerCase())
      .gte('attempted_at', oneHourAgo.toISOString());

    if (countError) {
      logger.error('Error checking rate limit', { endpoint: 'resetPassword', error: countError.message });
      return { allowed: false, error: 'Unable to verify rate limit. Please try again later.' };
    }
    const attemptCount = attempts?.length ?? 0;
    if (attemptCount >= MAX_RESET_ATTEMPTS) {
      return { allowed: false, error: 'Too many password reset attempts. Please try again later.' };
    }
    return { allowed: true };
  } catch (error) {
    logger.error('Error in checkRateLimit', { endpoint: 'resetPassword' }, error as Error);
    return { allowed: false, error: 'Unable to verify rate limit. Please try again later.' };
  }
}

async function recordResetAttempt(email: string): Promise<void> {
  try {
    const admin = createServiceRoleClient();
    await admin.from('password_reset_attempts').insert({
      email: email.toLowerCase(),
      ip_address: null,
      attempted_at: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error recording reset attempt', { endpoint: 'resetPassword' }, error as Error);
  }
}

/**
 * Request a password reset email. Validates email, rate limits, checks user exists,
 * generates recovery link via Supabase Admin, and sends custom Resend email.
 */
export async function resetPassword(email: string): Promise<{ success?: boolean; error?: string }> {
  try {
    if (!email || !email.includes('@')) {
      return { error: 'Please enter a valid email address' };
    }
    const normalizedEmail = email.toLowerCase().trim();
    logger.info('[ForgotPassword] reset requested', { email: normalizedEmail });

    const rateLimitCheck = await checkRateLimit(normalizedEmail);
    if (!rateLimitCheck.allowed) {
      logger.info('[ForgotPassword] rate limit exceeded', { email: normalizedEmail });
      return { error: rateLimitCheck.error ?? 'Too many password reset attempts. Please try again later.' };
    }
    logger.info('[ForgotPassword] rate limit ok', { email: normalizedEmail });

    const admin = createServiceRoleClient();
    const { data: listData, error: listError } = await admin.auth.admin.listUsers();
    if (listError) {
      logger.error('Error listing users for reset', { endpoint: 'resetPassword', error: listError.message });
      return { error: 'Unable to verify email. Please try again later.' };
    }
    const authUser = listData?.users?.find((u) => u.email?.toLowerCase() === normalizedEmail);
    if (!authUser) {
      logger.info('[ForgotPassword] user not found', { email: normalizedEmail });
      await recordResetAttempt(normalizedEmail);
      return { error: 'No account found with this email address. Please check your email and try again.' };
    }

    let profile: { first_name: string | null; last_name: string | null; preferred_locale: string | null } | null = null;
    const { data: profileData } = await admin
      .from('profiles')
      .select('first_name, last_name, preferred_locale')
      .eq('id', authUser.id)
      .single();
    profile = profileData ?? null;

    await recordResetAttempt(normalizedEmail);

    const siteUrl = getSiteUrl();
    const locale = profile?.preferred_locale === 'es' ? 'es' : 'en';
    const redirectTo = `${siteUrl}/${locale}/reset-password`;
    logger.info('[ForgotPassword] redirectTo', { redirectTo, locale, siteUrl });

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email: normalizedEmail,
      options: { redirectTo },
    });

    if (linkError || !linkData?.properties?.action_link) {
      logger.error('Error generating reset link', { endpoint: 'resetPassword', error: linkError?.message });
      return { error: 'Failed to generate reset link. Please try again later.' };
    }
    logger.info('[ForgotPassword] link generated', { email: normalizedEmail });

    const userName = profile?.first_name
      ? `${profile.first_name}${profile.last_name ? ' ' + profile.last_name : ''}`.trim()
      : undefined;
    const language = locale === 'es' ? 'es' : 'en';

    logger.info('[ForgotPassword] sending email', { email: normalizedEmail });
    const emailResult = await sendPasswordResetEmail({
      email: normalizedEmail,
      resetLink: linkData.properties.action_link,
      userName,
      language,
    });

    if (!emailResult.success) {
      logger.error('Error sending password reset email', { endpoint: 'resetPassword', error: emailResult.error });
      return { error: 'Failed to send reset email. Please try again later.' };
    }
    logger.info('[ForgotPassword] success', { email: normalizedEmail });
    return { success: true };
  } catch (error) {
    logger.error('Error in resetPassword', { endpoint: 'resetPassword' }, error as Error);
    return { error: 'An unexpected error occurred. Please try again later.' };
  }
}

/**
 * Update password for the current session (recovery). Call from reset-password page after user has valid session from link.
 */
export async function updatePassword(newPassword: string): Promise<{ success?: boolean; error?: string }> {
  try {
    logger.info('[ResetPassword] update requested');
    const parsed = passwordSchema.safeParse(newPassword);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? 'Password must be at least 8 characters and contain uppercase, lowercase, and number';
      return { error: msg };
    }
    logger.info('[ResetPassword] validation ok');

    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      logger.error('[ResetPassword] no session', { error: userError?.message });
      return { error: 'Invalid or expired reset link. Please request a new password reset.' };
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) {
      const msg = updateError.message ?? 'Failed to update password';
      const lower = msg.toLowerCase();
      if (
        lower.includes('same') ||
        lower.includes('previous') ||
        lower.includes('current') ||
        lower.includes('identical') ||
        lower.includes('unchanged')
      ) {
        return { error: 'New password cannot be the same as your current password. Please choose a different password.' };
      }
      return { error: msg };
    }
    logger.info('[ResetPassword] password updated', { userId: user?.id });
    return { success: true };
  } catch (error) {
    logger.error('Error in updatePassword', { endpoint: 'updatePassword' }, error as Error);
    return { error: 'An unexpected error occurred while updating password.' };
  }
}
