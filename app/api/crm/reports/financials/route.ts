import { NextRequest, NextResponse } from 'next/server';
import { requireCrmScope } from '@/lib/crm/crm-scope';
import { loadOwnerJobData, profitAndLoss } from '@/lib/crm/job-financials-db';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/crm/reports/financials?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Whole-business profit and loss: revenue, direct job costs by bucket, overhead by category,
 * actual vs. set overhead %, and every project and maintenance plan with its profit.
 */
export async function GET(request: NextRequest) {
  try {
    const { error, scope } = await requireCrmScope();
    if (error) return error;
    const params = new URL(request.url).searchParams;
    const today = new Date().toISOString().slice(0, 10);
    const from = DATE.test(params.get('from') ?? '') ? (params.get('from') as string) : `${today.slice(0, 4)}-01-01`;
    const to = DATE.test(params.get('to') ?? '') ? (params.get('to') as string) : today;
    if (from > to) return NextResponse.json({ error: 'The start date is after the end date' }, { status: 400 });

    const data = await loadOwnerJobData(scope.supabase, scope.ownerId, { range: { from, to }, today });
    return NextResponse.json(profitAndLoss(data, { from, to }));
  } catch (err) {
    console.error('profit and loss', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
