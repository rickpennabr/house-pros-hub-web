import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { requirePro } from '@/lib/crm/require-pro';

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
    const { data: rows, error } = await service
      .from('pro_estimate_bookings')
      .select(
        'id, business_id, customer_user_id, guest_email, guest_first_name, guest_last_name, guest_phone, service_name, slot_start_at, slot_end_at, status'
      )
      .in('business_id', ids)
      .lt('slot_start_at', to.toISOString())
      .gt('slot_end_at', from.toISOString())
      .order('slot_start_at', { ascending: true });
    if (error) {
      if (error.message?.includes('service_name') || error.code === '42703') {
        return NextResponse.json({ bookings: [], ready: false });
      }
      return NextResponse.json({ error: error.message || 'Failed to load bookings' }, { status: 500 });
    }

    const userIds = [...new Set((rows ?? []).map((row) => row.customer_user_id).filter((id): id is string => !!id))];
    const names = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profiles } = await service.from('profiles').select('id, first_name, last_name').in('id', userIds);
      for (const profile of profiles ?? []) {
        const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim();
        if (name) names.set(profile.id, name);
      }
    }

    const bookings = (rows ?? []).map((row) => {
      const guest = [row.guest_first_name, row.guest_last_name].filter(Boolean).join(' ').trim();
      return {
        id: row.id,
        businessId: row.business_id,
        name: guest || (row.customer_user_id ? names.get(row.customer_user_id) : '') || row.guest_email || 'Customer',
        phone: row.guest_phone,
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
