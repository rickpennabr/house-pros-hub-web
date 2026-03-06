import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasRole } from '@/lib/utils/roles';

async function requireContractor() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null };
  const isContractor = await hasRole(user.id, 'contractor');
  if (!isContractor) return { error: NextResponse.json({ error: 'Forbidden - Contractor access required' }, { status: 403 }), user: null };
  return { error: null, user };
}

/**
 * GET /api/crm/availability?from=ISO&to=ISO
 * List availability/calendar events for the authenticated contractor in the given range. ProBot can use this for scheduling.
 */
export async function GET(request: NextRequest) {
  try {
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError!;

    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    const from = fromParam ? new Date(fromParam) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const to = toParam ? new Date(toParam) : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59);

    const supabase = await createClient();
    const { data: rows, error } = await supabase
      .from('pro_crm_availability')
      .select('*')
      .eq('owner_id', user.id)
      .gte('end_at', from.toISOString())
      .lte('start_at', to.toISOString())
      .order('start_at', { ascending: true });

    if (error) return NextResponse.json({ error: error.message || 'Failed to fetch availability' }, { status: 500 });

    return NextResponse.json({ availability: rows ?? [] });
  } catch (err) {
    console.error('GET /api/crm/availability', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/crm/availability
 * Create an availability block (available, unavailable, or appointment).
 */
export async function POST(request: NextRequest) {
  try {
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError!;

    const body = await request.json();
    const type = ['available', 'unavailable', 'appointment'].includes(body.type) ? body.type : 'available';
    const startAt = body.startAt ?? body.start_at;
    const endAt = body.endAt ?? body.end_at;
    if (!startAt || !endAt) return NextResponse.json({ error: 'startAt and endAt are required' }, { status: 400 });

    const start = new Date(startAt);
    const end = new Date(endAt);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      return NextResponse.json({ error: 'Valid start and end times required; end must be after start' }, { status: 400 });
    }

    const note = typeof body.note === 'string' ? body.note.trim() || null : null;

    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from('pro_crm_availability')
      .insert({
        owner_id: user.id,
        type,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        note,
      })
      .select('id, start_at, end_at, type, note')
      .single();

    if (error) return NextResponse.json({ error: error.message || 'Failed to create availability' }, { status: 500 });
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    console.error('POST /api/crm/availability', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
