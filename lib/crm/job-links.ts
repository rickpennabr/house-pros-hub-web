import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/supabase';
import type { CrmDb } from '@/lib/crm/crm-scope';

type Client = SupabaseClient<Database>;

/**
 * Point an invoice at the project or maintenance plan it bills, so the job's financial report
 * counts it. Without an explicit job, an invoice made from an estimate goes to the project (or plan)
 * made from that estimate. Best effort: before migration 167 there is no column and nothing changes.
 */
export async function linkInvoiceToJob(
  supabase: Client,
  ownerId: string,
  invoiceId: string,
  link: { projectId?: unknown; maintenancePlanId?: unknown; estimateId?: string | null }
): Promise<void> {
  const db = supabase as unknown as CrmDb;
  let projectId = typeof link.projectId === 'string' && link.projectId ? link.projectId : null;
  let planId = !projectId && typeof link.maintenancePlanId === 'string' && link.maintenancePlanId ? link.maintenancePlanId : null;

  if (projectId) {
    const { data } = await db.from('pro_crm_projects').select('id').eq('id', projectId).eq('owner_id', ownerId).maybeSingle();
    if (!data) projectId = null;
  }
  if (planId) {
    const { data } = await db.from('pro_crm_maintenance_plans').select('id').eq('id', planId).eq('owner_id', ownerId).maybeSingle();
    if (!data) planId = null;
  }
  const explicit = link.projectId !== undefined || link.maintenancePlanId !== undefined;
  if (!projectId && !planId && !explicit && link.estimateId) {
    const { data: project } = await db
      .from('pro_crm_projects')
      .select('id')
      .eq('owner_id', ownerId)
      .eq('estimate_id', link.estimateId)
      .limit(1)
      .maybeSingle();
    if (project) projectId = project.id as string;
    else {
      const { data: plan } = await db
        .from('pro_crm_maintenance_plans')
        .select('id')
        .eq('owner_id', ownerId)
        .eq('source_estimate_id', link.estimateId)
        .limit(1)
        .maybeSingle();
      if (plan) planId = plan.id as string;
    }
  }
  if (!explicit && !projectId && !planId) return;
  await db
    .from('pro_crm_invoices')
    .update({ project_id: projectId, maintenance_plan_id: planId })
    .eq('id', invoiceId)
    .eq('owner_id', ownerId);
}

/** Parse a labor cost per hour from a request body: cents, null to clear, undefined to keep. */
export function laborRateFromBody(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const cents = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(cents) && cents >= 0 && cents <= 10_000_000 ? cents : undefined;
}

/** Save a contact's labor cost per hour on its own, so the rest of the contact saves before migration 167. */
export async function saveContactLaborRate(
  supabase: Client,
  ownerId: string,
  contactId: string,
  cents: number | null | undefined
): Promise<void> {
  if (cents === undefined) return;
  await (supabase as unknown as CrmDb)
    .from('pro_crm_customers')
    .update({ labor_cost_cents_per_hour: cents })
    .eq('id', contactId)
    .eq('owner_id', ownerId);
}
