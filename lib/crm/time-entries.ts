import { z } from 'zod';
import type { CrmScope } from '@/lib/crm/crm-scope';
import { contactDisplayName } from '@/lib/crm/contact-name';
import { loadCostingSettings } from '@/lib/crm/job-financials-db';

export const TIME_SETUP_ERROR = 'Logging hours needs a database update (migration 167) first.';

export function timeSchemaMissing(message: string | undefined): boolean {
  return Boolean(
    message &&
      /pro_crm_time_entries|labor_cost_cents_per_hour/.test(message) &&
      /does not exist|schema cache|Could not find/i.test(message)
  );
}

const uuid = z.string().uuid();

export const timeEntryInputSchema = z
  .object({
    projectId: uuid.nullish(),
    maintenancePlanId: uuid.nullish(),
    contactId: uuid.nullish(),
    crewMemberId: uuid.nullish(),
    personName: z.string().trim().max(120).nullish(),
    workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    hours: z.number().positive().max(24),
    /** Leave out to use the person's labor cost, or the default crew cost. */
    rateCentsPerHour: z.number().int().min(0).max(10_000_000).nullish(),
    note: z.string().trim().max(500).nullish(),
  })
  .refine((value) => Boolean(value.projectId || value.maintenancePlanId), {
    message: 'Pick a project or maintenance plan',
  });

export type TimeEntryInput = z.infer<typeof timeEntryInputSchema>;

/** Who worked and what they cost per hour: the contact's or crew member's rate, then the default crew rate. */
export async function resolveWorker(
  scope: CrmScope,
  input: Pick<TimeEntryInput, 'contactId' | 'crewMemberId' | 'personName' | 'rateCentsPerHour'>
): Promise<{ name: string | null; rate: number } | { error: string }> {
  const db = scope.supabase;
  let name = input.personName?.trim() || null;
  let rate: number | null = input.rateCentsPerHour ?? null;
  if (input.contactId) {
    const { data } = await db
      .from('pro_crm_customers')
      .select('*')
      .eq('id', input.contactId)
      .eq('owner_id', scope.ownerId)
      .maybeSingle();
    if (!data) return { error: 'Contact not found' };
    name = name ?? contactDisplayName(data);
    if (rate == null && typeof data.labor_cost_cents_per_hour === 'number') rate = data.labor_cost_cents_per_hour;
  } else if (input.crewMemberId) {
    const { data } = await db
      .from('business_crew_members')
      .select('*')
      .eq('id', input.crewMemberId)
      .eq('owner_id', scope.ownerId)
      .maybeSingle();
    if (!data) return { error: 'Crew member not found' };
    name = name ?? (data.display_name as string);
    if (rate == null && typeof data.labor_cost_cents_per_hour === 'number') rate = data.labor_cost_cents_per_hour;
  }
  if (rate == null) rate = (await loadCostingSettings(db, scope.ownerId)).defaultLaborCentsPerHour;
  return { name, rate };
}

/** Make sure the project or plan belongs to this business. */
export async function checkJob(
  scope: CrmScope,
  input: Pick<TimeEntryInput, 'projectId' | 'maintenancePlanId'>
): Promise<string | null> {
  const db = scope.supabase;
  if (input.projectId) {
    const { data } = await db
      .from('pro_crm_projects')
      .select('id')
      .eq('id', input.projectId)
      .eq('owner_id', scope.ownerId)
      .maybeSingle();
    if (!data) return 'Project not found';
  }
  if (input.maintenancePlanId) {
    const { data } = await db
      .from('pro_crm_maintenance_plans')
      .select('id')
      .eq('id', input.maintenancePlanId)
      .eq('owner_id', scope.ownerId)
      .maybeSingle();
    if (!data) return 'Maintenance plan not found';
  }
  return null;
}

/** Columns for an insert or update. */
export function timeEntryColumns(input: TimeEntryInput, worker: { name: string | null; rate: number }) {
  return {
    project_id: input.projectId ?? null,
    maintenance_plan_id: input.projectId ? null : input.maintenancePlanId ?? null,
    contact_id: input.contactId ?? null,
    crew_member_id: input.contactId ? null : input.crewMemberId ?? null,
    person_name: worker.name,
    work_date: input.workDate,
    hours: input.hours,
    rate_cents_per_hour: worker.rate,
    note: input.note || null,
  };
}
