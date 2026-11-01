import type { User } from '@supabase/supabase-js';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { ADMIN_EMAIL } from '@/lib/constants/admin';
import { logger } from '@/lib/utils/logger';

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

/**
 * After Google sign-in, make sure a brand-new account is a customer.
 * Existing contractor, realtor, or installer accounts keep their roles.
 */
export async function provisionGoogleCustomer(user: User): Promise<void> {
  const service = createServiceRoleClient();
  const { data: roles, error: rolesError } = await service
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id);

  if (rolesError) {
    logger.error('[Google customer] failed to read roles', { userId: user.id, error: rolesError.message });
    throw new Error('Could not finish Google sign-up');
  }

  const existingRoles = roles ?? [];
  const email = user.email?.trim().toLowerCase() ?? '';
  const isAdmin = email.length > 0 && email === ADMIN_EMAIL.toLowerCase();
  const isNewAccount = existingRoles.length === 0 && !isAdmin;

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

  const { firstName, lastName } = nameFromGoogle(user);
  const { data: profile } = await service
    .from('profiles')
    .select('first_name, last_name, user_picture')
    .eq('id', user.id)
    .maybeSingle();

  const { error: profileError } = await service.from('profiles').upsert(
    {
      id: user.id,
      first_name: profile?.first_name?.trim() || firstName,
      last_name: profile?.last_name?.trim() || lastName || null,
      user_picture: profile?.user_picture || pictureFromGoogle(user),
    },
    { onConflict: 'id' }
  );

  if (profileError) {
    logger.error('[Google customer] failed to save profile', { userId: user.id, error: profileError.message });
  }

  if (isNewAccount) {
    const displayName = `${firstName} ${lastName}`.trim() || email || 'Customer';
    const { error: eventError } = await service.from('admin_notification_events').insert({
      event_type: 'signup',
      entity_type: 'customer',
      entity_id: user.id,
      display_name: displayName,
    });
    if (eventError) {
      logger.warn('[Google customer] failed to log signup event', { userId: user.id, error: eventError.message });
    }
  }
}
