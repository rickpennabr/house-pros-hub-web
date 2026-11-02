import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserRoles } from '@/lib/utils/roles';

/** Contractor or realtor. Both own a business and can run hours, booking, and the calendar. */
export async function requirePro() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null, supabase };
  }
  const roles = await getUserRoles(user.id);
  if (!roles.includes('contractor') && !roles.includes('realtor')) {
    return {
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
      user: null,
      supabase,
    };
  }
  return { error: null, user, supabase };
}
