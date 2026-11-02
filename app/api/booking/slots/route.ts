import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { openSlotsForDay } from '@/lib/booking/openSlots';

/**
 * GET /api/booking/slots?businessId=UUID&date=YYYY-MM-DD
 * Open appointment times for one civil date in the business timezone.
 * Hours come from the pro's weekly schedule. Time off and existing bookings are removed.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    const dateStr = searchParams.get('date');
    if (!businessId || !dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return NextResponse.json({ error: 'businessId and date (YYYY-MM-DD) are required' }, { status: 400 });
    }

    const service = createServiceRoleClient();
    const result = await openSlotsForDay(service, businessId, dateStr);
    if (!result) return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    return NextResponse.json(result);
  } catch (err) {
    console.error('GET /api/booking/slots', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
