import { NextRequest, NextResponse } from 'next/server';
import { requireCrmScope } from '@/lib/crm/crm-scope';
import { checkJob, resolveWorker, timeEntryColumns, timeEntryInputSchema } from '@/lib/crm/time-entries';

/** PATCH /api/crm/time-entries/[id]: change logged hours. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, scope } = await requireCrmScope();
  if (error) return error;
  const { id } = await params;
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
    .update({ ...timeEntryColumns(input, worker), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('owner_id', scope.ownerId)
    .select('*')
    .maybeSingle();
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ entry: data });
}

/** DELETE /api/crm/time-entries/[id] */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, scope } = await requireCrmScope();
  if (error) return error;
  const { id } = await params;
  const { error: dbError } = await scope.supabase
    .from('pro_crm_time_entries')
    .delete()
    .eq('id', id)
    .eq('owner_id', scope.ownerId);
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
