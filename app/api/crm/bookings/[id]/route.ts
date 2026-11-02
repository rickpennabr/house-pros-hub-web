import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { requirePro } from '@/lib/crm/require-pro';
import { slotIsOpen } from '@/lib/booking/openSlots';

/**
 * PATCH /api/crm/bookings/[id]
 * Complete, cancel, or move a customer appointment. The new time must still be an open slot.
 */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { error: authError, user, supabase } = await requirePro();
    if (authError || !user) return authError!;
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));

    const service = createServiceRoleClient();
    const { data: booking, error: loadError } = await service
      .from('pro_estimate_bookings')
      .select('id, business_id, status')
      .eq('id', id)
      .maybeSingle();
    if (loadError || !booking) return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });

    const { data: owned } = await supabase
      .from('businesses')
      .select('id')
      .eq('id', booking.business_id)
      .eq('owner_id', user.id)
      .maybeSingle();
    if (!owned) return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });

    const status = body.status === 'cancelled' || body.status === 'completed' ? body.status : null;
    const nextStart = typeof body.slotStartAt === 'string' ? new Date(body.slotStartAt) : null;
    const nextEnd = typeof body.slotEndAt === 'string' ? new Date(body.slotEndAt) : null;

    if (!status && (!nextStart || !nextEnd)) {
      return NextResponse.json({ error: 'status or a new time is required' }, { status: 400 });
    }

    const update: { status?: 'cancelled' | 'completed'; slot_start_at?: string; slot_end_at?: string } = {};
    if (status) update.status = status;
    if (nextStart && nextEnd) {
      if (isNaN(nextStart.getTime()) || isNaN(nextEnd.getTime()) || nextEnd <= nextStart) {
        return NextResponse.json({ error: 'Invalid time' }, { status: 400 });
      }
      const open = await slotIsOpen(service, booking.business_id, nextStart, nextEnd, booking.id);
      if (open !== 'ok') {
        return NextResponse.json({ error: 'That time is not open' }, { status: 400 });
      }
      update.slot_start_at = nextStart.toISOString();
      update.slot_end_at = nextEnd.toISOString();
    }

    const { error } = await service.from('pro_estimate_bookings').update(update).eq('id', booking.id);
    if (error) return NextResponse.json({ error: error.message || 'Failed to update' }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/crm/bookings/[id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
