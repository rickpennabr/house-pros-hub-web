import { NextRequest, NextResponse } from 'next/server';
import { requireCrmScope } from '@/lib/crm/crm-scope';
import { safeTimeZone, todayKeyInZone } from '@/lib/crm/estimate-chart';

/**
 * GET /api/crm/maintenance/summary?timeZone=
 * Indicator cards on the Maintenance page: active plans, visits due this week, overdue visits, visits done this month.
 */
export async function GET(request: NextRequest) {
  try {
    const { error, scope } = await requireCrmScope();
    if (error || !scope) return error!;
    const { supabase, ownerId } = scope;
    const today = todayKeyInZone(safeTimeZone(request.nextUrl.searchParams.get('timeZone')));
    const weekEnd = new Date(`${today}T12:00:00Z`);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
    const inAWeek = weekEnd.toISOString().slice(0, 10);
    const monthStart = `${today.slice(0, 7)}-01`;

    const [plansResult, visitsResult] = await Promise.all([
      supabase.from('pro_crm_maintenance_plans').select('next_visit_date, end_date, is_active').eq('owner_id', ownerId).limit(5000),
      supabase
        .from('pro_crm_maintenance_visits')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', ownerId)
        .gte('started_at', `${monthStart}T00:00:00Z`)
        .neq('status', 'cancelled'),
    ]);
    if (plansResult.error) return NextResponse.json({ error: plansResult.error.message }, { status: 500 });

    let active = 0;
    let dueThisWeek = 0;
    let overdue = 0;
    for (const plan of (plansResult.data ?? []) as Array<{ next_visit_date: string | null; end_date: string | null; is_active: boolean }>) {
      if (!plan.is_active || (plan.end_date && plan.end_date < today)) continue;
      active += 1;
      if (!plan.next_visit_date) continue;
      if (plan.next_visit_date < today) overdue += 1;
      else if (plan.next_visit_date <= inAWeek) dueThisWeek += 1;
    }
    return NextResponse.json({ active, dueThisWeek, overdue, visitsThisMonth: visitsResult.count ?? 0 });
  } catch (err) {
    console.error('GET /api/crm/maintenance/summary', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
