import { NextRequest, NextResponse } from 'next/server';
import { requireCrmScope } from '@/lib/crm/crm-scope';
import { jobFinancialsFrom, loadOwnerJobData, type JobKey } from '@/lib/crm/job-financials-db';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/crm/job-financials?project=<id> or ?plan=<id>
 * A job's money: contract, invoiced, collected, costs by bucket, overhead, profit, and every cost line.
 */
export async function GET(request: NextRequest) {
  try {
    const { error, scope } = await requireCrmScope();
    if (error) return error;
    const params = new URL(request.url).searchParams;
    const project = params.get('project');
    const plan = params.get('plan');
    const id = project ?? plan;
    if (!id || !UUID.test(id)) return NextResponse.json({ error: 'Pass a project or plan id' }, { status: 400 });
    const key: JobKey = project ? `project:${id}` : `plan:${id}`;

    const data = await loadOwnerJobData(scope.supabase, scope.ownerId, {
      only: key,
      today: new Date().toISOString().slice(0, 10),
    });
    const job = data.jobs.get(key);
    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({
      job,
      settings: data.settings,
      invoices: data.invoices.get(key) ?? [],
      financials: jobFinancialsFrom(data, key),
    });
  } catch (err) {
    console.error('job financials', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
