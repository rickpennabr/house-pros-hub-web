import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { requirePro } from '@/lib/crm/require-pro';
import { formatVisitAddress } from '@/lib/booking/visitAddress';

function visitField(row: object, key: string): string | null {
  const value = (row as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : null;
}

/**
 * GET /api/crm/bookings?from=ISO&to=ISO
 * Customer estimate appointments on the pro's businesses.
 */
export async function GET(request: NextRequest) {
  try {
    const { error: authError, user, supabase } = await requirePro();
    if (authError || !user) return authError!;

    const { searchParams } = new URL(request.url);
    const from = new Date(searchParams.get('from') ?? '');
    const to = new Date(searchParams.get('to') ?? '');
    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return NextResponse.json({ error: 'from and to are required' }, { status: 400 });
    }

    const { data: businesses, error: businessError } = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_id', user.id);
    if (businessError) return NextResponse.json({ error: businessError.message }, { status: 500 });
    const ids = (businesses ?? []).map((row) => row.id);
    if (ids.length === 0) return NextResponse.json({ bookings: [] });

    const service = createServiceRoleClient();
    const baseColumns =
      'id, business_id, customer_user_id, guest_email, guest_first_name, guest_last_name, guest_phone, service_name, slot_start_at, slot_end_at, status';
    const visitColumns = ', visit_street, visit_city, visit_state, visit_zip, visit_note';
    const fullResult = await service
      .from('pro_estimate_bookings')
      .select(`${baseColumns}${visitColumns}`)
      .in('business_id', ids)
      .lt('slot_start_at', to.toISOString())
      .gt('slot_end_at', from.toISOString())
      .order('slot_start_at', { ascending: true });
    const result =
      fullResult.error && (fullResult.error.message ?? '').includes('visit_street')
        ? await service
            .from('pro_estimate_bookings')
            .select(baseColumns)
            .in('business_id', ids)
            .lt('slot_start_at', to.toISOString())
            .gt('slot_end_at', from.toISOString())
            .order('slot_start_at', { ascending: true })
        : fullResult;
    const { data: rows, error } = result;
    if (error) {
      if (error.message?.includes('service_name') || error.code === '42703') {
        return NextResponse.json({ bookings: [], ready: false });
      }
      return NextResponse.json({ error: error.message || 'Failed to load bookings' }, { status: 500 });
    }

    const userIds = [...new Set((rows ?? []).map((row) => row.customer_user_id).filter((id): id is string => !!id))];
    const names = new Map<string, string>();
    const phones = new Map<string, string>();
    const emails = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profiles } = await service.from('profiles').select('id, first_name, last_name, phone').in('id', userIds);
      for (const profile of profiles ?? []) {
        const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim();
        if (name) names.set(profile.id, name);
        if (profile.phone) phones.set(profile.id, profile.phone);
      }
      await Promise.all(
        userIds.map(async (userId) => {
          const { data } = await service.auth.admin.getUserById(userId);
          const email = data?.user?.email?.trim().toLowerCase();
          if (email) emails.set(userId, email);
        })
      );
    }

    const bookings = (rows ?? []).map((row) => {
      const guest = [row.guest_first_name, row.guest_last_name].filter(Boolean).join(' ').trim();
      return {
        id: row.id,
        businessId: row.business_id,
        name: guest || (row.customer_user_id ? names.get(row.customer_user_id) : '') || row.guest_email || 'Customer',
        phone: row.guest_phone || (row.customer_user_id ? phones.get(row.customer_user_id) ?? null : null),
        email: row.guest_email || (row.customer_user_id ? emails.get(row.customer_user_id) ?? null : null),
        address: formatVisitAddress({
          street: visitField(row, 'visit_street'),
          city: visitField(row, 'visit_city'),
          state: visitField(row, 'visit_state'),
          zip: visitField(row, 'visit_zip'),
        }) || null,
        note: visitField(row, 'visit_note'),
        serviceName: row.service_name,
        startAt: row.slot_start_at,
        endAt: row.slot_end_at,
        status: row.status,
      };
    });
    return NextResponse.json({ bookings });
  } catch (err) {
    console.error('GET /api/crm/bookings', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
