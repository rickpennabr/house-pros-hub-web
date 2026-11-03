import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { CHANGE_LEAD_MS, isManageToken } from '@/lib/booking/appointmentPolicy';
import { loadManageBooking } from '@/lib/booking/loadManageBooking';
import { openSlotsForDay } from '@/lib/booking/openSlots';

/**
 * GET /api/appointments/[token]/slots?date=YYYY-MM-DD
 * Open times for a reschedule. The current visit is not treated as busy.
 * Times inside the 2-hour window are omitted.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const rateLimitRes = await checkRateLimit(request, 'appointmentManage');
  if (rateLimitRes) return rateLimitRes;

  try {
    const { token } = await context.params;
    const date = new URL(request.url).searchParams.get('date') ?? '';
    if (!isManageToken(token) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    }

    const service = createServiceRoleClient();
    const booking = await loadManageBooking(service, token);
    if (!booking) return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    if (!booking.canChange) return NextResponse.json({ error: 'This appointment can no longer be changed' }, { status: 409 });

    const result = await openSlotsForDay(service, booking.businessId, date, new Date(), booking.id);
    if (!result) return NextResponse.json({ error: 'Business not found' }, { status: 404 });

    const earliest = Date.now() + CHANGE_LEAD_MS;
    const currentStart = Date.parse(booking.startAt);
    const slots = result.slots.filter((slot) => Date.parse(slot.start) >= earliest && Date.parse(slot.start) !== currentStart);
    return NextResponse.json({ slots, timezone: result.timezone, closed: result.closed });
  } catch (err) {
    console.error('GET /api/appointments/[token]/slots', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
