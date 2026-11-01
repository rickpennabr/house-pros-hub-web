import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

/**
 * GET /api/booking/availability?businessId=UUID&from=ISO&to=ISO
 * Public: returns availability blocks for the given business (pro's calendar).
 * Used by "Book a ProEstimate" to show when the pro is available.
 * Only "available" type blocks are returned; "unavailable" and "appointment" are not bookable.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('businessId');
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    if (!businessId) {
      return NextResponse.json({ error: 'businessId is required' }, { status: 400 });
    }

    const from = fromParam ? new Date(fromParam) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const to = toParam ? new Date(toParam) : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59);

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
    const { data: rows, error } = await service
      .from('pro_crm_availability')
      .select('id, type, start_at, end_at')
      .eq('owner_id', business.owner_id)
      .eq('type', 'available')
      .gte('end_at', from.toISOString())
      .lte('start_at', to.toISOString())
      .order('start_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to fetch availability' }, { status: 500 });
    }

    return NextResponse.json({ availability: rows ?? [] });
  } catch (err) {
    console.error('GET /api/booking/availability', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
