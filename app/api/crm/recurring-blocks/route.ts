import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { requirePro } from '@/lib/crm/require-pro';
import { parseRecurringBlockInput } from '@/lib/booking/recurringBlocks';

const COLUMNS = 'id, weekdays, start_time, end_time, every_weeks, starts_on, ends_on, note';

/** The table is newer than the generated Supabase types. */
async function db(): Promise<SupabaseClient> {
  return (await createClient()) as unknown as SupabaseClient;
}

/** GET /api/crm/recurring-blocks: the pro's repeating busy times. */
export async function GET() {
  try {
    const { error: authError, user } = await requirePro();
    if (authError || !user) return authError!;
    const supabase = await db();
    const { data, error } = await supabase
      .from('pro_recurring_blocks')
      .select(COLUMNS)
      .eq('owner_id', user.id)
      .order('created_at', { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ blocks: data ?? [] });
  } catch (err) {
    console.error('GET /api/crm/recurring-blocks', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** POST /api/crm/recurring-blocks: { weekdays: number[] (0=Mon), startTime, endTime, everyWeeks, startsOn?, endsOn?, note? } */
export async function POST(request: NextRequest) {
  try {
    const { error: authError, user } = await requirePro();
    if (authError || !user) return authError!;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = parseRecurringBlockInput(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const supabase = await db();
    const { data, error } = await supabase
      .from('pro_recurring_blocks')
      .insert({ ...parsed.row, owner_id: user.id })
      .select(COLUMNS)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error('POST /api/crm/recurring-blocks', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
