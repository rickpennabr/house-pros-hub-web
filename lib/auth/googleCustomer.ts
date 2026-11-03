import type { User } from '@supabase/supabase-js';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { ADMIN_EMAIL } from '@/lib/constants/admin';
import { logger } from '@/lib/utils/logger';
import { sendNewSignupAdminNotification } from '@/lib/services/emailService';
import { recordAdminBellEvent } from '@/lib/services/adminNotifications';
import { classifyGoogleAccount } from '@/lib/auth/googleAccount';

function textMeta(meta: Record<string, unknown>, key: string): string {
  const value = meta[key];
  return typeof value === 'string' ? value.trim() : '';
}

function nameFromGoogle(user: User): { firstName: string; lastName: string } {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const given = textMeta(meta, 'given_name');
  const family = textMeta(meta, 'family_name');
  if (given || family) {
    return { firstName: given || 'Customer', lastName: family };
  }
  const full = textMeta(meta, 'full_name') || textMeta(meta, 'name');
  if (!full) return { firstName: 'Customer', lastName: '' };
  const parts = full.split(/\s+/);
  return { firstName: parts[0] || 'Customer', lastName: parts.slice(1).join(' ') };
}

function pictureFromGoogle(user: User): string | null {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const picture = textMeta(meta, 'avatar_url') || textMeta(meta, 'picture');
  return picture || null;
}

function providersFromUser(user: User): string[] {
  return (user.identities ?? [])
    .map((identity) => identity.provider)
    .filter((provider): provider is string => typeof provider === 'string' && provider.length > 0);
}

type SavedProfile = {
  first_name: string | null;
  last_name: string | null;
  user_picture: string | null;
  phone: string | null;
  referral: string | null;
  business_id: string | null;
  company_role: string | null;
};

function profileHasSavedDetails(profile: SavedProfile | null): boolean {
  if (!profile) return false;
  return Boolean(
    profile.phone?.trim() ||
      profile.referral?.trim() ||
      profile.business_id ||
      profile.company_role?.trim() ||
      (profile.first_name?.trim() && profile.last_name?.trim())
  );
}

/**
 * Google sign-in merges provider fields into user metadata. Put the name from
 * the form profile back so the account does not start showing the Google name.
 */
async function keepProfileName(
  service: ReturnType<typeof createServiceRoleClient>,
  user: User,
  profile: SavedProfile | null
) {
  const firstName = profile?.first_name?.trim() ?? '';
  const lastName = profile?.last_name?.trim() ?? '';
  if (!firstName) return;

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const metaLast = typeof meta.lastName === 'string' ? meta.lastName : '';
  if (meta.firstName === firstName && metaLast === lastName) return;

  const { error } = await service.auth.admin.updateUserById(user.id, {
    user_metadata: { firstName, lastName },
  });
  if (error) {
    logger.warn('[Google customer] could not keep the profile name', {
      userId: user.id,
      error: error.message,
    });
  }
}

/**
 * After Google sign-in, make sure a brand-new account is a customer.
 * An email/password account with the same address stays that account:
 * same role, phone, business, and name. Google is only an extra way to sign in.
 */
export async function provisionGoogleCustomer(user: User): Promise<'new' | 'existing'> {
  const service = createServiceRoleClient();
  const { data: adminData, error: adminError } = await service.auth.admin.getUserById(user.id);
  const account = adminData.user ?? user;
  if (adminError) {
    logger.warn('[Google customer] could not reload the auth user', {
      userId: user.id,
      error: adminError.message,
    });
  }

  const { data: roles, error: rolesError } = await service
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id);

  if (rolesError) {
    logger.error('[Google customer] failed to read roles', { userId: user.id, error: rolesError.message });
    throw new Error('Could not finish Google sign-up');
  }

  const { data: profile, error: profileReadError } = await service
    .from('profiles')
    .select('first_name, last_name, user_picture, phone, referral, business_id, company_role')
    .eq('id', user.id)
    .maybeSingle();

  if (profileReadError) {
    logger.error('[Google customer] failed to read profile', { userId: user.id, error: profileReadError.message });
    throw new Error('Could not finish Google sign-up');
  }

  const existingRoles = roles ?? [];
  const email = account.email?.trim().toLowerCase() ?? '';
  const isAdmin = email.length > 0 && email === ADMIN_EMAIL.toLowerCase();
  const kind = classifyGoogleAccount({
    userCreatedAt: account.created_at,
    providers: providersFromUser(account),
    hasRoles: existingRoles.length > 0,
    hasSavedProfile: profileHasSavedDetails(profile),
  });

  if (kind === 'existing') {
    logger.info('[Google customer] linked Google to an existing account', { userId: user.id });
    if (existingRoles.length === 0 && !isAdmin) {
      const { error: roleError } = await service.from('user_roles').insert({
        user_id: user.id,
        role: 'customer',
        is_active: true,
        activated_at: new Date().toISOString(),
      });
      if (roleError) {
        // The account already exists and the session is valid. A missing role is worth
        // fixing, not worth blocking the sign-in this person just completed.
        logger.error('[Google customer] failed to assign customer role', { userId: user.id, error: roleError.message });
      }
    }

    const { firstName, lastName } = nameFromGoogle(account);
    const picture = pictureFromGoogle(account);
    const patch: { first_name?: string; last_name?: string | null; user_picture?: string } = {};
    if (profile) {
      if (!profile.first_name?.trim() && firstName) patch.first_name = firstName;
      if (!profile.last_name?.trim() && lastName) patch.last_name = lastName;
      if (!profile.user_picture && picture) patch.user_picture = picture;
    }

    if (profile && Object.keys(patch).length > 0) {
      const { error: updateError } = await service.from('profiles').update(patch).eq('id', user.id);
      if (updateError) {
        logger.error('[Google customer] failed to fill empty profile fields', {
          userId: user.id,
          error: updateError.message,
        });
      }
    } else if (!profile) {
      const { error: insertError } = await service.from('profiles').insert({
        id: user.id,
        first_name: firstName,
        last_name: lastName || null,
        user_picture: picture,
      });
      if (insertError) {
        logger.error('[Google customer] failed to save profile', { userId: user.id, error: insertError.message });
      }
    }

    await keepProfileName(service, account, profile);
    return 'existing';
  }

  const isNewAccount = !isAdmin;
  if (isNewAccount) {
    const { error: roleError } = await service.from('user_roles').insert({
      user_id: user.id,
      role: 'customer',
      is_active: true,
      activated_at: new Date().toISOString(),
    });
    if (roleError) {
      logger.error('[Google customer] failed to assign customer role', { userId: user.id, error: roleError.message });
      throw new Error('Could not finish Google sign-up');
    }
  }

  const { firstName, lastName } = nameFromGoogle(account);
  const picture = pictureFromGoogle(account);
  const nameFields = {
    first_name: profile?.first_name?.trim() || firstName,
    last_name: profile?.last_name?.trim() || lastName || null,
    user_picture: profile?.user_picture || picture,
  };

  const { error: profileError } = profile
    ? await service.from('profiles').update(nameFields).eq('id', user.id)
    : await service.from('profiles').insert({ id: user.id, ...nameFields });

  if (profileError) {
    logger.error('[Google customer] failed to save profile', { userId: user.id, error: profileError.message });
  }

  if (isNewAccount) {
    const displayName = `${firstName} ${lastName}`.trim() || email || 'Customer';
    await recordAdminBellEvent({
      eventType: 'signup',
      entityType: 'customer',
      entityId: user.id,
      displayName,
      detail: email || null,
    });
    if (email) {
      const adminNotify = await sendNewSignupAdminNotification({
        type: 'customer',
        name: displayName,
        email,
      });
      if (!adminNotify.success) {
        logger.warn('[Google customer] failed to email admin about signup', {
          userId: user.id,
          error: adminNotify.error,
        });
      }
    }
  }

  return isNewAccount ? 'new' : 'existing';
}
