import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requirePro } from '@/lib/crm/require-pro';

const TASK_TYPES = ['estimate_appointment', 'business_meeting', 'follow_up', 'other'] as const;

async function requireCalendarPro() {
  const result = await requirePro();
  return { error: result.error, user: result.user };
}

/**
 * GET /api/crm/tasks?from=ISO&to=ISO
 * List tasks for the authenticated contractor in the given range.
 */
export async function GET(request: NextRequest) {
  try {
    const { error: authError, user } = await requireCalendarPro();
    if (authError || !user) return authError!;

    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    const from = fromParam ? new Date(fromParam) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const to = toParam ? new Date(toParam) : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59);

    const supabase = await createClient();
    const { data: rows, error } = await supabase
      .from('pro_crm_tasks')
      .select(`
        id,
        task_type,
        other_label,
        customer_id,
        meeting_with,
        start_at,
        end_at,
        note,
        created_at,
        pro_crm_customers ( first_name, last_name, display_name )
      `)
      .eq('owner_id', user.id)
      .gte('end_at', from.toISOString())
      .lte('start_at', to.toISOString())
      .order('start_at', { ascending: true });

    if (error) return NextResponse.json({ error: error.message || 'Failed to fetch tasks' }, { status: 500 });
    return NextResponse.json({ tasks: rows ?? [] });
  } catch (err) {
    console.error('GET /api/crm/tasks', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/crm/tasks
 * Create a task. Body: task_type, other_label?, customer_id?, meeting_with?, startAt, endAt, note?
 */
export async function POST(request: NextRequest) {
  try {
    const { error: authError, user } = await requireCalendarPro();
    if (authError || !user) return authError!;

    const body = await request.json().catch(() => ({}));
    const taskType = TASK_TYPES.includes(body.task_type) ? body.task_type : null;
    if (!taskType) return NextResponse.json({ error: 'Valid task_type is required' }, { status: 400 });

    const startAt = body.startAt ?? body.start_at;
    const endAt = body.endAt ?? body.end_at;
    if (!startAt || !endAt) return NextResponse.json({ error: 'startAt and endAt are required' }, { status: 400 });

    const start = new Date(startAt);
    const end = new Date(endAt);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      return NextResponse.json({ error: 'Valid start and end times required' }, { status: 400 });
    }

    const supabase = await createClient();
    const customerId = typeof body.customer_id === 'string' && body.customer_id ? body.customer_id : null;

    const { data: row, error } = await supabase
      .from('pro_crm_tasks')
      .insert({
        owner_id: user.id,
        task_type: taskType,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        other_label: taskType === 'other' && typeof body.other_label === 'string' ? body.other_label.trim() || null : null,
        customer_id: customerId,
        meeting_with: typeof body.meeting_with === 'string' ? body.meeting_with.trim() || null : null,
        note: typeof body.note === 'string' ? body.note.trim() || null : null,
        created_by: user.id,
      })
      .select('id, display_id, task_type, start_at, end_at, customer_id, meeting_with, created_at')
      .single();

    if (error) return NextResponse.json({ error: error.message || 'Failed to create task' }, { status: 500 });
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    console.error('POST /api/crm/tasks', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
