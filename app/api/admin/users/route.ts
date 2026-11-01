import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { ADMIN_EMAIL } from '@/lib/constants/admin';

export interface AdminUserRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  business_id: string | null;
  business_name: string | null;
  roles: string[];
  is_active: boolean;
  created_at: string;
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (user.email?.toLowerCase().trim() !== ADMIN_EMAIL.toLowerCase().trim()) {
    return { error: NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 }) };
  }
  return { error: null };
}

/**
 * GET /api/admin/users
 * Every account on the site, with role and business. The admin login is listed as admin.
 */
export async function GET() {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    const service = createServiceRoleClient();
    const adminEmail = ADMIN_EMAIL.toLowerCase().trim();

    const [{ data: profiles, error: profilesError }, { data: roleRows, error: rolesError }, { data: businesses, error: businessesError }] =
      await Promise.all([
        service.from('profiles').select('id, first_name, last_name, business_id, created_at').order('created_at', { ascending: false }),
        service.from('user_roles').select('user_id, role, is_active'),
        service.from('businesses').select('id, business_name'),
      ]);

    if (profilesError || rolesError || businessesError) {
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    const emailMap = new Map<string, string>();
    try {
      let pageNum = 1;
      const perPage = 1000;
      while (true) {
        const { data, error } = await service.auth.admin.listUsers({ page: pageNum, perPage });
        if (error || !data?.users?.length) break;
        for (const user of data.users) {
          if (user.email) emailMap.set(user.id, user.email);
        }
        if (data.users.length < perPage) break;
        pageNum++;
      }
    } catch {
      // Names and roles still load if auth emails are unavailable.
    }

    const businessNames = new Map((businesses || []).map((business) => [business.id, business.business_name]));

    const users: AdminUserRow[] = (profiles || []).map((profile) => {
      const email = emailMap.get(profile.id) ?? null;
      const isAdmin = !!email && email.toLowerCase().trim() === adminEmail;
      const activeRoles = (roleRows || [])
        .filter((row) => row.user_id === profile.id && row.is_active)
        .map((row) => row.role);
      const roles = isAdmin
        ? ['admin', ...activeRoles.filter((role) => role !== 'customer')]
        : activeRoles;

      return {
        id: profile.id,
        first_name: profile.first_name,
        last_name: profile.last_name,
        email,
        business_id: profile.business_id,
        business_name: profile.business_id ? businessNames.get(profile.business_id) ?? null : null,
        roles,
        is_active: isAdmin || activeRoles.length > 0,
        created_at: profile.created_at,
      };
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('GET /api/admin/users', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
