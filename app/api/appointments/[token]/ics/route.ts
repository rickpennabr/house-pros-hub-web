import { NextRequest, NextResponse } from 'next/server';
import { appointmentManageUrl, isManageToken } from '@/lib/booking/appointmentPolicy';
import { originFromRequest } from '@/lib/booking/appointmentNotice';
import { visitCalendarDescription, visitCalendarTitle } from '@/lib/booking/calendarLinks';
import { loadManageBooking } from '@/lib/booking/loadManageBooking';
import { buildVisitIcs } from '@/lib/booking/visitIcs';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { createServiceRoleClient } from '@/lib/supabase/server';

/**
 * GET /api/appointments/[token]/ics
 * Download the visit as a calendar file. The manage token is the credential.
 * The file uses the same event id as the confirmation email, so importing it again
 * updates the visit instead of creating a second one.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const rateLimitRes = await checkRateLimit(request, 'appointmentManage');
  if (rateLimitRes) return rateLimitRes;

  try {
    const { token } = await context.params;
    if (!isManageToken(token)) return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    const booking = await loadManageBooking(createServiceRoleClient(), token);
    if (!booking) return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });

    const manageUrl = appointmentManageUrl(originFromRequest(request), booking.customerLocale, token);
    const ics = buildVisitIcs({
      bookingId: booking.id,
      summary: visitCalendarTitle(booking.businessName, booking.serviceName),
      description: visitCalendarDescription([booking.businessName, booking.visitNote, manageUrl]),
      location: booking.visitAddress ?? '',
      startAt: booking.startAt,
      endAt: booking.endAt,
      method: booking.status === 'cancelled' ? 'CANCEL' : 'PUBLISH',
      sequence: booking.icsSequence,
    });

    return new NextResponse(ics, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="visit.ics"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('GET /api/appointments/[token]/ics', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
