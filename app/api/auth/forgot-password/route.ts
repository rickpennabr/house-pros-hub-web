import { NextRequest, NextResponse } from 'next/server';
import { isValidEmail } from '@/lib/validation';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getMessages } from 'next-intl/server';
import { sendPasswordResetEmail } from '@/lib/services/emailService';
import type { PasswordResetEmailTranslations } from '@/lib/utils/emailTemplates';
import { logger } from '@/lib/utils/logger';

const MAX_RESET_ATTEMPTS = 3;
const RATE_LIMIT_WINDOW_HOURS = 1;

/**
 * POST /api/auth/forgot-password
 * BrazaLink-style: custom Resend email with Supabase admin generateLink (hash-based link),
 * DB-backed per-email rate limiting. Only sends email if account exists (BrazaLink-style messaging).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const locale = (typeof body.locale === 'string' ? body.locale : request.headers.get('x-locale')) || 'en';
    const validLocale = locale === 'es' ? 'es' : 'en';

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const service = createServiceRoleClient();

    // 1. Clean up expired attempts and check per-email rate limit
    const { error: cleanupError } = await service.rpc('cleanup_expired_password_reset_attempts');
    if (cleanupError) {
      logger.warn('Forgot-password cleanup RPC failed', { error: cleanupError.message });
    }

    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - RATE_LIMIT_WINDOW_HOURS);

    const { data: attempts, error: countError } = await service
      .from('password_reset_attempts')
      .select('id')
      .eq('email', normalizedEmail)
      .gte('attempted_at', oneHourAgo.toISOString());

    if (countError) {
      logger.error('Forgot-password rate limit check failed', { error: countError.message });
      return NextResponse.json(
        { error: 'Unable to verify rate limit. Please try again later.' },
        { status: 503 }
      );
    }

    const attemptCount = attempts?.length ?? 0;
    if (attemptCount >= MAX_RESET_ATTEMPTS) {
      return NextResponse.json(
        { error: 'Too many password reset attempts. Please try again later.' },
        { status: 429 }
      );
    }

    // 2. Check if user exists (auth.admin.listUsers and find by email)
    const perPage = 500;
    const maxPages = 20;
    let page = 1;
    let authUser: { id: string; email?: string } | null = null;

    while (page <= maxPages) {
      const { data, error } = await service.auth.admin.listUsers({ page, perPage });
      if (error) {
        logger.error('Forgot-password listUsers failed', { error: error.message });
        return NextResponse.json(
          { error: 'Unable to verify email. Please try again later.' },
          { status: 500 }
        );
      }
      const found = data?.users?.find((u) => u.email?.toLowerCase() === normalizedEmail);
      if (found) {
        authUser = { id: found.id, email: found.email };
        break;
      }
      if (!data?.users?.length || data.users.length < perPage) break;
      page++;
    }

    if (!authUser) {
      // Record attempt before returning "not found" so abuse is rate limited
      await service.from('password_reset_attempts').insert({
        email: normalizedEmail,
        ip_address: null,
        attempted_at: new Date().toISOString(),
      });
      return NextResponse.json(
        { error: 'No account found with this email address. Please check your email and try again.' },
        { status: 404 }
      );
    }

    // 3. Generate recovery link (redirectTo = app reset-password page with locale; tokens in hash)
    const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || (() => {
      try {
        return new URL(request.url).origin;
      } catch {
        return 'https://houseproshub.com';
      }
    })()).replace(/\/$/, '');
    const redirectTo = `${baseUrl}/${validLocale}/reset-password`;

    const { data: linkData, error: linkError } = await service.auth.admin.generateLink({
      type: 'recovery',
      email: normalizedEmail,
      options: { redirectTo },
    });

    if (linkError || !linkData?.properties?.action_link) {
      logger.error('Forgot-password generateLink failed', {
        email: normalizedEmail,
        error: linkError?.message,
      });
      return NextResponse.json(
        { error: 'Failed to generate reset link. Please try again later.' },
        { status: 500 }
      );
    }

    let resetLink = linkData.properties.action_link;
    if (!resetLink.startsWith('http')) {
      const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
      resetLink = `${supabaseUrl}/${resetLink.replace(/^\//, '')}`;
    }

    // 4. Get translations and optional profile name
    const messages = await getMessages({ locale: validLocale });
    const pr = (messages?.auth as Record<string, unknown>)?.passwordResetEmail as Record<string, unknown> | undefined;
    const footer = pr?.footer as Record<string, string> | undefined;

    const translations: PasswordResetEmailTranslations = {
      subject: (pr?.subject as string) || 'Reset your password – House Pros Hub',
      greeting: (pr?.greeting as string) || 'Hello',
      body: (pr?.body as string) || "We received a request to reset your password for your House Pros Hub account. Click the button below to reset your password. This link will expire in 1 hour.",
      cta: (pr?.cta as string) || 'Reset Password',
      securityNote: (pr?.securityNote as string) || 'Security note:',
      securityText: (pr?.securityText as string) || 'If you did not request a password reset, please ignore this email. Your password will remain unchanged.',
      expiryNote: (pr?.expiryNote as string) || 'This link will expire in 1 hour.',
      footer: {
        companyName: footer?.companyName || 'House Pros Hub',
        contactInfo: footer?.contactInfo || 'If you have any questions, please contact us.',
        unsubscribe: footer?.unsubscribe || 'You are receiving this email because a password reset was requested for your House Pros Hub account.',
      },
    };

    const { data: profile } = await service
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', authUser.id)
      .single();

    const userName = profile?.first_name
      ? [profile.first_name, profile.last_name].filter(Boolean).join(' ')
      : undefined;

    const emailResult = await sendPasswordResetEmail(
      normalizedEmail,
      resetLink,
      translations,
      { userName }
    );

    if (!emailResult.success) {
      logger.error('Forgot-password send email failed', { email: normalizedEmail, error: emailResult.error });
      return NextResponse.json(
        { error: 'Failed to send reset email. Please try again later.' },
        { status: 500 }
      );
    }

    // Record attempt after successful send for rate limiting
    await service.from('password_reset_attempts').insert({
      email: normalizedEmail,
      ip_address: null,
      attempted_at: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        message: 'If an account exists with this email, you will receive a password reset link shortly.',
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('Forgot-password unhandled error', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
