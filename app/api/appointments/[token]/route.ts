import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { CHANGE_LOCKED_ERROR, isManageToken, slotIsFarEnough } from '@/lib/booking/appointmentPolicy';
import { notifyBookingChange, originFromRequest } from '@/lib/booking/appointmentNotice';
import { appointmentCard, loadManageBooking } from '@/lib/booking/loadManageBooking';
import { slotIsOpen } from '@/lib/booking/openSlots';

/**
 * GET /api/appointments/[token]
 * Appointment details for the customer manage link. The token is the credential.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const rateLimitRes = await checkRateLimit(request, 'appointmentManage');
  if (rateLimitRes) return rateLimitRes;

  try {
    const { token } = await context.params;
    if (!isManageToken(token)) return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    const booking = await loadManageBooking(createServiceRoleClient(), token);
    if (!booking) return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    return NextResponse.json({ appointment: appointmentCard(booking) });
  } catch (err) {
    console.error('GET /api/appointments/[token]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/appointments/[token]
 * Cancel or reschedule until 2 hours before the visit. Emails the customer and the pro.
 * Body: { action: 'cancel' } or { action: 'reschedule', slotStartAt, slotEndAt }
 */
export async function PATCH(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const rateLimitRes = await checkRateLimit(request, 'appointmentManage');
  if (rateLimitRes) return rateLimitRes;

  try {
    const { token } = await context.params;
    if (!isManageToken(token)) return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    const body = await request.json().catch(() => ({}));
    const action = body.action === 'cancel' || body.action === 'reschedule' ? body.action : null;
    if (!action) return NextResponse.json({ error: 'action is required' }, { status: 400 });

    const service = createServiceRoleClient();
    const booking = await loadManageBooking(service, token);
    if (!booking) return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
    if (!booking.canChange) return NextResponse.json({ error: CHANGE_LOCKED_ERROR }, { status: 409 });

    const previousStart = new Date(booking.startAt);
    if (action === 'cancel') {
      const { error } = await service.from('pro_estimate_bookings').update({ status: 'cancelled' }).eq('id', booking.id);
      if (error) return NextResponse.json({ error: error.message || 'Failed to cancel' }, { status: 500 });
    } else {
      const nextStart = new Date(body.slotStartAt);
      const nextEnd = new Date(body.slotEndAt);
      if (isNaN(nextStart.getTime()) || isNaN(nextEnd.getTime()) || nextEnd <= nextStart) {
        return NextResponse.json({ error: 'Invalid time' }, { status: 400 });
      }
      if (nextStart.getTime() === previousStart.getTime()) {
        return NextResponse.json({ error: 'Choose a different time' }, { status: 400 });
      }
      if (!slotIsFarEnough(nextStart, new Date())) {
        return NextResponse.json({ error: CHANGE_LOCKED_ERROR }, { status: 409 });
      }
      const open = await slotIsOpen(service, booking.businessId, nextStart, nextEnd, booking.id);
      if (open !== 'ok') return NextResponse.json({ error: 'That time is not open' }, { status: 400 });
      const { error } = await service
        .from('pro_estimate_bookings')
        .update({ slot_start_at: nextStart.toISOString(), slot_end_at: nextEnd.toISOString() })
        .eq('id', booking.id);
      if (error) return NextResponse.json({ error: error.message || 'Failed to reschedule' }, { status: 500 });
    }

    await notifyBookingChange(service, {
      bookingId: booking.id,
      kind: action === 'cancel' ? 'cancelled' : 'rescheduled',
      actor: 'customer',
      origin: originFromRequest(request),
      previousStart,
    });

    const updated = await loadManageBooking(service, token);
    return NextResponse.json({ appointment: updated ? appointmentCard(updated) : null });
  } catch (err) {
    console.error('PATCH /api/appointments/[token]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
