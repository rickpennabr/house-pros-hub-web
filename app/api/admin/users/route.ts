import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { ADMIN_EMAIL } from '@/lib/constants/admin';
import { HOUSE_TRADES, NV_BUSINESS_LICENSE_CODE, tradeFromLicense } from '@/lib/pros/house-trades';
import { loadBusinessTrades } from '@/lib/pros/business-trades';

export interface AdminUserRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  business_id: string | null;
  business_name: string | null;
  roles: string[];
  /** House trade slug the pro identifies with (their business's trade, else from their license or role). */
  trade: string | null;
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
        service.from('businesses').select('id, business_name, owner_id'),
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
    const businessByOwner = new Map<string, string>();
    for (const business of businesses || []) {
      if (business.owner_id && !businessByOwner.has(business.owner_id)) businessByOwner.set(business.owner_id, business.id);
    }
    const businessIds = (businesses || []).map((business) => business.id);
    const [tradesByBusiness, { data: licenseRows }] = await Promise.all([
      loadBusinessTrades(businessIds, service),
      businessIds.length
        ? service.from('licenses').select('business_id, license_type, license_name').in('business_id', businessIds)
        : Promise.resolve({ data: [] as { business_id: string; license_type: string | null; license_name: string | null }[] }),
    ]);
    const firstLicense = new Map<string, { license_type: string | null; license_name: string | null }>();
    for (const row of licenseRows ?? []) {
      if (row.business_id && !firstLicense.has(row.business_id)) firstLicense.set(row.business_id, row);
    }
    const tradeForBusiness = (businessId: string | null | undefined): string | null => {
      if (!businessId) return null;
      const picked = tradesByBusiness.get(businessId)?.primaryTrade;
      if (picked) return picked;
      const license = firstLicense.get(businessId);
      if (!license) return null;
      // Service pros on a Nevada Business License carry their trade's category as the license name.
      if (license.license_type === NV_BUSINESS_LICENSE_CODE) {
        return HOUSE_TRADES.find((trade) => trade.category === license.license_name)?.slug ?? null;
      }
      return tradeFromLicense(license.license_type);
    };

    const users: AdminUserRow[] = (profiles || []).map((profile) => {
      const email = emailMap.get(profile.id) ?? null;
      const isAdmin = !!email && email.toLowerCase().trim() === adminEmail;
      const activeRoles = (roleRows || [])
        .filter((row) => row.user_id === profile.id && row.is_active)
        .map((row) => row.role);
      const roles = isAdmin
        ? ['admin', ...activeRoles.filter((role) => role !== 'customer')]
        : activeRoles;

      const businessId = profile.business_id ?? businessByOwner.get(profile.id) ?? null;
      const trade = activeRoles.includes('realtor') && !activeRoles.includes('contractor')
        ? null
        : tradeForBusiness(businessId) ??
          (activeRoles.includes('handyman') ? 'handyman' : activeRoles.includes('installer') ? 'installer' : null);

      return {
        id: profile.id,
        first_name: profile.first_name,
        last_name: profile.last_name,
        email,
        business_id: profile.business_id,
        business_name: profile.business_id ? businessNames.get(profile.business_id) ?? null : null,
        roles,
        trade,
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
