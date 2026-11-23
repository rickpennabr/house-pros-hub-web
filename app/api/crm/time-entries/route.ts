import { NextRequest, NextResponse } from 'next/server';
import { requireCrmScope } from '@/lib/crm/crm-scope';
import {
  checkJob,
  resolveWorker,
  TIME_SETUP_ERROR,
  timeEntryColumns,
  timeEntryInputSchema,
  timeSchemaMissing,
} from '@/lib/crm/time-entries';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** GET /api/crm/time-entries?project=<id> or ?plan=<id>: hours logged on a job, newest first. */
export async function GET(request: NextRequest) {
  const { error, scope } = await requireCrmScope();
  if (error) return error;
  const params = new URL(request.url).searchParams;
  const project = params.get('project');
  const plan = params.get('plan');
  let query = scope.supabase.from('pro_crm_time_entries').select('*').eq('owner_id', scope.ownerId);
  if (project && UUID.test(project)) query = query.eq('project_id', project);
  else if (plan && UUID.test(plan)) query = query.eq('maintenance_plan_id', plan);
  else return NextResponse.json({ error: 'Pass a project or plan id' }, { status: 400 });
  const { data, error: dbError } = await query.order('work_date', { ascending: false }).limit(1000);
  if (dbError) {
    if (timeSchemaMissing(dbError.message)) return NextResponse.json({ entries: [], setupError: TIME_SETUP_ERROR });
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }
  return NextResponse.json({ entries: data ?? [] });
}

/** POST /api/crm/time-entries: log hours on a project or maintenance plan. */
export async function POST(request: NextRequest) {
  const { error, scope } = await requireCrmScope();
  if (error) return error;
  const parsed = timeEntryInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid hours' }, { status: 400 });
  }
  const input = parsed.data;
  const jobError = await checkJob(scope, input);
  if (jobError) return NextResponse.json({ error: jobError }, { status: 404 });
  const worker = await resolveWorker(scope, input);
  if ('error' in worker) return NextResponse.json({ error: worker.error }, { status: 404 });

  const { data, error: dbError } = await scope.supabase
    .from('pro_crm_time_entries')
    .insert({ owner_id: scope.ownerId, ...timeEntryColumns(input, worker) })
    .select('*')
    .single();
  if (dbError) {
    if (timeSchemaMissing(dbError.message)) return NextResponse.json({ error: TIME_SETUP_ERROR }, { status: 503 });
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }
  return NextResponse.json({ entry: data }, { status: 201 });
}
