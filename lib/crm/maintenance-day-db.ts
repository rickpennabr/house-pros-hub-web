import type { CrmDb } from '@/lib/crm/crm-scope';

export type MaintenanceDayRow = {
  id: string;
  owner_id: string;
  business_id: string | null;
  work_date: string;
  status: 'open' | 'closed';
  started_at: string;
  ended_at: string | null;
  total_visit_seconds: number;
  total_break_seconds: number;
  total_trip_seconds: number;
  total_labor_seconds: number;
  visit_count: number;
  trip_count: number;
  max_workers: number;
  notes: string | null;
};

export function mapDay(row: MaintenanceDayRow) {
  return {
    id: row.id,
    ownerId: row.owner_id,
    businessId: row.business_id,
    workDate: row.work_date,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    totalVisitSeconds: row.total_visit_seconds,
    totalBreakSeconds: row.total_break_seconds,
    totalTripSeconds: row.total_trip_seconds,
    totalLaborSeconds: row.total_labor_seconds,
    visitCount: row.visit_count,
    tripCount: row.trip_count,
    maxWorkers: row.max_workers,
    notes: row.notes,
  };
}

/** Get or create today's open maintenance day for the owner. */
export async function ensureOpenMaintenanceDay(
  supabase: CrmDb,
  ownerId: string,
  businessId: string | null
): Promise<MaintenanceDayRow> {
  const { data: open } = await supabase
    .from('pro_crm_maintenance_days')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('status', 'open')
    .maybeSingle();

  if (open) return open as MaintenanceDayRow;

  const workDate = new Date().toISOString().slice(0, 10);
  const { data: created, error } = await supabase
    .from('pro_crm_maintenance_days')
    .insert({
      owner_id: ownerId,
      business_id: businessId,
      work_date: workDate,
      status: 'open',
      started_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error || !created) {
    throw new Error(error?.message ?? 'Could not open maintenance day');
  }
  return created as MaintenanceDayRow;
}

export async function recomputeDayTotals(supabase: CrmDb, dayId: string, ownerId: string) {
  const [{ data: visits }, { data: trips }] = await Promise.all([
    supabase
      .from('pro_crm_maintenance_visits')
      .select('duration_seconds, break_seconds, labor_seconds, worker_count, status')
      .eq('day_id', dayId)
      .eq('owner_id', ownerId),
    supabase
      .from('pro_crm_maintenance_day_trips')
      .select('duration_seconds, ended_at')
      .eq('day_id', dayId)
      .eq('owner_id', ownerId),
  ]);

  const completed = (visits ?? []).filter((row) => row.status === 'completed');
  const totalVisitSeconds = completed.reduce((sum, row) => sum + (row.duration_seconds ?? 0), 0);
  const counted = (visits ?? []).filter((row) => row.status !== 'cancelled');
  const totalBreakSeconds = counted.reduce((sum, row) => sum + (row.break_seconds ?? 0), 0);
  const totalLaborSeconds = completed.reduce((sum, row) => sum + (row.labor_seconds ?? 0), 0);
  const maxWorkers = Math.max(1, ...counted.map((row) => row.worker_count ?? 1));
  const closedTrips = (trips ?? []).filter((row) => row.ended_at);
  const totalTripSeconds = closedTrips.reduce((sum, row) => sum + (row.duration_seconds ?? 0), 0);

  await supabase
    .from('pro_crm_maintenance_days')
    .update({
      total_visit_seconds: totalVisitSeconds,
      total_break_seconds: totalBreakSeconds,
      total_trip_seconds: totalTripSeconds,
      total_labor_seconds: totalLaborSeconds,
      visit_count: completed.length,
      trip_count: closedTrips.length,
      max_workers: maxWorkers,
    })
    .eq('id', dayId)
    .eq('owner_id', ownerId);
}

export async function closeOpenTripOnDay(
  supabase: CrmDb,
  dayId: string,
  ownerId: string,
  opts?: { toVisitId?: string | null; toCustomerId?: string | null }
) {
  const { data: openTrip } = await supabase
    .from('pro_crm_maintenance_day_trips')
    .select('id, started_at')
    .eq('day_id', dayId)
    .eq('owner_id', ownerId)
    .is('ended_at', null)
    .maybeSingle();

  if (!openTrip) return null;

  const endedAt = new Date();
  const durationSeconds = Math.max(
    0,
    Math.floor((endedAt.getTime() - new Date(openTrip.started_at).getTime()) / 1000)
  );

  const { data: updated } = await supabase
    .from('pro_crm_maintenance_day_trips')
    .update({
      ended_at: endedAt.toISOString(),
      duration_seconds: durationSeconds,
      to_visit_id: opts?.toVisitId ?? null,
      to_customer_id: opts?.toCustomerId ?? null,
    })
    .eq('id', openTrip.id)
    .select('*')
    .single();

  return updated;
}
