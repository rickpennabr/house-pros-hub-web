import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { hasRole } from '@/lib/utils/roles';

/**
 * True when the user can use Pros CRM (estimates, invoices, chat share links).
 * Accepts the contractor role or anyone who owns a business — role rows are often missing
 * for older pro accounts that still run a live business page.
 */
export async function userCanAccessCrm(userId: string): Promise<boolean> {
  if (await hasRole(userId, 'contractor')) return true;
  const service = createServiceRoleClient();
  const { data } = await service
    .from('businesses')
    .select('id')
    .eq('owner_id', userId)
    .limit(1)
    .maybeSingle();
  return Boolean(data?.id);
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
