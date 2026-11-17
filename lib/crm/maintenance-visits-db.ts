import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_MAINTENANCE_SERVICES } from '@/lib/crm/maintenance-defaults';

export type MaintenanceServiceOption = {
  id: string;
  name: string;
  descriptionTemplate: string;
  sortOrder: number;
  isActive: boolean;
  isDefaultSeed: boolean;
};

export type MaintenanceVisitRow = {
  id: string;
  owner_id: string;
  business_id: string | null;
  customer_id: string;
  maintenance_plan_id: string | null;
  project_id: string | null;
  day_id: string | null;
  status: 'in_progress' | 'on_break' | 'completed' | 'cancelled';
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  break_seconds: number;
  pause_started_at: string | null;
  worker_count: number;
  labor_seconds: number | null;
  notes: string | null;
  generated_description: string | null;
  responsible_crew_id: string | null;
  responsible_contact_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export async function ensureDefaultMaintenanceServices(
  supabase: SupabaseClient,
  ownerId: string
): Promise<void> {
  const { count } = await supabase
    .from('pro_crm_maintenance_service_options')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', ownerId);

  if ((count ?? 0) > 0) return;

  const rows = DEFAULT_MAINTENANCE_SERVICES.map((service) => ({
    owner_id: ownerId,
    name: service.name,
    description_template: service.description_template,
    sort_order: service.sort_order,
    is_active: true,
    is_default_seed: true,
  }));

  await supabase.from('pro_crm_maintenance_service_options').insert(rows);
}

export function mapServiceOption(row: {
  id: string;
  name: string;
  description_template: string;
  sort_order: number;
  is_active: boolean;
  is_default_seed: boolean;
}): MaintenanceServiceOption {
  return {
    id: row.id,
    name: row.name,
    descriptionTemplate: row.description_template,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    isDefaultSeed: row.is_default_seed,
  };
}

export function mapVisit(row: MaintenanceVisitRow) {
  return {
    id: row.id,
    ownerId: row.owner_id,
    businessId: row.business_id,
    customerId: row.customer_id,
    maintenancePlanId: row.maintenance_plan_id,
    projectId: row.project_id,
    dayId: row.day_id,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationSeconds: row.duration_seconds,
    breakSeconds: row.break_seconds ?? 0,
    pauseStartedAt: row.pause_started_at,
    workerCount: row.worker_count ?? 1,
    laborSeconds: row.labor_seconds,
    notes: row.notes,
    generatedDescription: row.generated_description,
    responsibleCrewId: row.responsible_crew_id,
    responsibleContactId: row.responsible_contact_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
