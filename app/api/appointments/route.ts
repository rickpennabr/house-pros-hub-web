import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { canChangeAppointment } from '@/lib/booking/appointmentPolicy';
import { safeTimeZone } from '@/lib/booking/dayOfReminder';

/**
 * GET /api/appointments
 * Upcoming and recent visits for the signed-in customer, including guest bookings on the same email.
 */
export async function GET(request: NextRequest) {
  const rateLimitRes = await checkRateLimit(request, 'appointmentManage');
  if (rateLimitRes) return rateLimitRes;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Sign in required' }, { status: 401 });

    const service = createServiceRoleClient();
    const email = user.email?.trim().toLowerCase() ?? '';
    const columns =
      'id, business_id, manage_token, service_name, slot_start_at, slot_end_at, status, customer_user_id, guest_email';

    const [byUser, byEmail] = await Promise.all([
      service.from('pro_estimate_bookings').select(columns).eq('customer_user_id', user.id).order('slot_start_at', { ascending: false }).limit(40),
      email
        ? service.from('pro_estimate_bookings').select(columns).eq('guest_email', email).order('slot_start_at', { ascending: false }).limit(40)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (byUser.error) return NextResponse.json({ error: byUser.error.message }, { status: 500 });
    if (byEmail.error) return NextResponse.json({ error: byEmail.error.message }, { status: 500 });

    const merged = new Map<string, NonNullable<typeof byUser.data>[number]>();
    for (const row of [...(byUser.data ?? []), ...(byEmail.data ?? [])]) merged.set(row.id, row);

    const businessIds = [...new Set([...merged.values()].map((row) => row.business_id))];
    const names = new Map<string, { name: string; timezone: string }>();
    if (businessIds.length > 0) {
      const { data: businesses } = await service.from('businesses').select('id, business_name, timezone').in('id', businessIds);
      for (const business of businesses ?? []) {
        names.set(business.id, {
          name: business.business_name?.trim() || 'Pro',
          timezone: safeTimeZone(business.timezone),
        });
      }
    }

    const now = new Date();
    const appointments = [...merged.values()]
      .map((row) => {
        const business = names.get(row.business_id);
        return {
          token: row.manage_token,
          businessName: business?.name ?? 'Pro',
          serviceName: row.service_name,
          startAt: row.slot_start_at,
          endAt: row.slot_end_at,
          status: row.status,
          timezone: business?.timezone ?? 'America/Los_Angeles',
          canChange: canChangeAppointment(new Date(row.slot_start_at), now, row.status),
        };
      })
      .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));

    return NextResponse.json({ appointments });
  } catch (err) {
    console.error('GET /api/appointments', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
