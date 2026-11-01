import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getStandardSlotsForDay } from '@/lib/constants/bookingSlots';

/**
 * GET /api/booking/slots?businessId=UUID&date=YYYY-MM-DD
 * Returns available 1.5-hour slots for the given business on the given day (local date).
 * Matches CRM calendar UX: "All slots available by default; mark OFF when not free."
 * - If pro has no "available" blocks for the day: show all standard slots except "unavailable" and booked.
 * - If pro has "available" blocks: only show slots that fit entirely inside one (and exclude unavailable + booked).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    const dateStr = searchParams.get('date');

    if (!businessId || !dateStr) {
      return NextResponse.json({ error: 'businessId and date are required' }, { status: 400 });
    }

    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 });
    }
    const [, y, m, d] = match;
    const dayStart = new Date(parseInt(y!, 10), parseInt(m!, 10) - 1, parseInt(d!, 10), 0, 0, 0);
    const dayEnd = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate(), 23, 59, 59);

    const supabase = await createClient();
    const { data: business, error: bizError } = await supabase
      .from('businesses')
      .select('id, owner_id')
      .eq('id', businessId)
      .eq('is_active', true)
      .single();

    if (bizError || !business?.owner_id) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const service = createServiceRoleClient();

    const { data: availableBlocks } = await service
      .from('pro_crm_availability')
      .select('start_at, end_at')
      .eq('owner_id', business.owner_id)
      .eq('type', 'available')
      .lte('start_at', dayEnd.toISOString())
      .gte('end_at', dayStart.toISOString());

    const { data: unavailableBlocks } = await service
      .from('pro_crm_availability')
      .select('start_at, end_at')
      .eq('owner_id', business.owner_id)
      .eq('type', 'unavailable')
      .lte('start_at', dayEnd.toISOString())
      .gte('end_at', dayStart.toISOString());

    const { data: bookings } = await service
      .from('pro_estimate_bookings')
      .select('slot_start_at, slot_end_at')
      .eq('business_id', businessId)
      .eq('status', 'confirmed')
      .gte('slot_end_at', dayStart.toISOString())
      .lte('slot_start_at', dayEnd.toISOString());

    const standardSlots = getStandardSlotsForDay(dayStart);
    const hasExplicitAvailable = (availableBlocks?.length ?? 0) > 0;

    const slots: { start: string; end: string }[] = [];
    for (const { start: slotStart, end: slotEnd } of standardSlots) {
      if (slotEnd > dayEnd) continue;
      const slotStartTime = slotStart.getTime();
      const slotEndTime = slotEnd.getTime();

      // If pro added explicit "available" blocks, slot must fit inside one (CRM "mark when available" mode).
      // Otherwise, all standard slots are available by default (CRM "mark OFF when not free" mode).
      if (hasExplicitAvailable) {
        const fitsInAvailable = availableBlocks!.some(
          (b) =>
            new Date(b.start_at).getTime() <= slotStartTime &&
            new Date(b.end_at).getTime() >= slotEndTime
        );
        if (!fitsInAvailable) continue;
      }

      const isUnavailable = unavailableBlocks?.some(
        (b) =>
          new Date(b.start_at).getTime() < slotEndTime &&
          new Date(b.end_at).getTime() > slotStartTime
      );
      if (isUnavailable) continue;

      const booked = bookings?.some(
        (b) =>
          slotStartTime < new Date(b.slot_end_at).getTime() &&
          slotEndTime > new Date(b.slot_start_at).getTime()
      );
      if (booked) continue;

      slots.push({ start: slotStart.toISOString(), end: slotEnd.toISOString() });
    }

    return NextResponse.json({ slots });
  } catch (err) {
    console.error('GET /api/booking/slots', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
