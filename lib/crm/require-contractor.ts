import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { hasAnyRole, type UserRole } from '@/lib/utils/roles';

/** Roles that can open Pros CRM and its APIs. */
export const CRM_ACCESS_ROLES: UserRole[] = ['contractor', 'realtor', 'installer', 'handyman'];

/**
 * True when the user can use Pros CRM (estimates, invoices, chat share links).
 * Accepts contractor, realtor, installer, or handyman — or anyone who owns a business
 * (role rows are often missing for older pro accounts that still run a live business page).
 */
/** True when the user owns CRM data (pro role or owns a business). Crew alone is false. */
export async function userOwnsCrm(userId: string): Promise<boolean> {
  if (await hasAnyRole(userId, CRM_ACCESS_ROLES)) return true;
  const service = createServiceRoleClient();
  const { data } = await service
    .from('businesses')
    .select('id')
    .eq('owner_id', userId)
    .limit(1)
    .maybeSingle();
  return Boolean(data?.id);
}

export async function userCanAccessCrm(userId: string): Promise<boolean> {
  if (await userOwnsCrm(userId)) return true;
  const service = createServiceRoleClient();
  // Table added in 138_maintenance_visits; cast until supabase.ts is regenerated.
  const { data: crew } = await (service as any)
    .from('business_crew_members')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  return Boolean(crew?.id);
}

export async function requireContractor() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null, supabase };
  }
  if (!(await userCanAccessCrm(user.id))) {
    return {
      error: NextResponse.json({ error: 'Forbidden - Contractor access required' }, { status: 403 }),
      user: null,
      supabase,
    };
  }
  return { error: null, user, supabase };
}
