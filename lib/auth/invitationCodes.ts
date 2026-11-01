import type { SupabaseClient } from '@supabase/supabase-js';

export type InvitationRole = 'contractor' | 'realtor' | 'installer';

export interface InvitationCodeRow {
  id: string;
  expires_at: string;
  used_at: string | null;
}

export function parseInvitationRole(value: unknown): InvitationRole {
  if (value === 'realtor') return 'realtor';
  if (value === 'installer') return 'installer';
  return 'contractor';
}

/**
 * Why a code cannot be used. Null means the row is still valid.
 */
export function invitationCodeBlockReason(row: InvitationCodeRow | null): string | null {
  if (!row) return 'Invalid or expired invitation code.';
  if (row.used_at) return 'This invitation code has already been used.';
  if (new Date(row.expires_at) <= new Date()) return 'Invalid or expired invitation code.';
  return null;
}

export async function findInvitationCode(
  service: SupabaseClient,
  role: InvitationRole,
  rawCode: string
): Promise<{ row: InvitationCodeRow | null; error: { message: string } | null }> {
  const code = rawCode.trim().toUpperCase();
  const { data, error } = await service
    .from('invitation_codes')
    .select('id, expires_at, used_at')
    .eq('role', role)
    .eq('code', code)
    .maybeSingle();

  return { row: (data as InvitationCodeRow | null) ?? null, error };
}
