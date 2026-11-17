import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { userCanAccessCrm } from '@/lib/crm/require-contractor';

/** Same CRM access as requireContractor — contractor, realtor, installer, handyman, or business owner. */
export async function requirePro() {
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
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
      user: null,
      supabase,
    };
  }
  return { error: null, user, supabase };
}
