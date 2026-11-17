import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/types/supabase';
import {
  datePlusDays,
  isMaintenanceFrequency,
  MAINTENANCE_FREQUENCY_LABELS,
  nextVisitOffsetDays,
  todayDateKey,
  toRecurringInvoiceFrequency,
  type MaintenanceFrequency,
} from '@/lib/crm/estimate-agreement';
import { recordCustomerPlaceEvent } from '@/lib/places/timeline';

type Client = SupabaseClient<Database>;

export interface StartMaintenanceResult {
  planId: string | null;
  recurringInvoiceId: string | null;
  error: string | null;
}

/**
 * When a maintenance agreement is accepted, start the place plan and (when possible)
 * a matching recurring visit invoice schedule. Idempotent via source_estimate_id.
 */
export async function startMaintenanceFromEstimate(
  supabase: Client,
  estimateId: string
): Promise<StartMaintenanceResult> {
  const { data: estimate, error } = await supabase
    .from('pro_crm_estimates')
    .select(
      'id, owner_id, customer_id, display_id, amount_cents, deposit_cents, line_items, note, job_area, agreement_kind, maintenance_frequency, status'
    )
    .eq('id', estimateId)
    .maybeSingle();

  if (error || !estimate) {
    return { planId: null, recurringInvoiceId: null, error: error?.message || 'Estimate not found' };
  }
  if (estimate.agreement_kind !== 'maintenance') {
    return { planId: null, recurringInvoiceId: null, error: null };
  }
  if (!isMaintenanceFrequency(estimate.maintenance_frequency)) {
    return {
      planId: null,
      recurringInvoiceId: null,
      error: 'Maintenance agreements need a visit schedule before they can start',
    };
  }

  const frequency = estimate.maintenance_frequency as MaintenanceFrequency;
  const label = String(estimate.display_id ?? estimate.id.slice(0, 8));
  const area = estimate.job_area?.trim() || null;
  const name = (area ? `Maintenance · ${area}` : 'Maintenance agreement').slice(0, 120);
  const summaryParts = [
    `From estimate #${label}`,
    MAINTENANCE_FREQUENCY_LABELS[frequency],
    estimate.note?.trim() || null,
  ].filter(Boolean);
  const today = todayDateKey();
  const nextVisit = datePlusDays(today, nextVisitOffsetDays(frequency));
  const visitAmount = Math.max(0, (estimate.amount_cents ?? 0) - (estimate.deposit_cents ?? 0)) || estimate.amount_cents;

  const { data: existing } = await supabase
    .from('pro_crm_maintenance_plans')
    .select('id')
    .eq('source_estimate_id', estimate.id)
    .maybeSingle();

  let planId = existing?.id ?? null;
  if (!planId) {
    const { data: plan, error: planError } = await supabase
      .from('pro_crm_maintenance_plans')
      .insert({
        owner_id: estimate.owner_id,
        customer_id: estimate.customer_id,
        name,
        summary: summaryParts.join(' · ').slice(0, 1000) || null,
        frequency,
        next_visit_date: nextVisit,
        last_visit_date: null,
        end_date: null,
        is_active: true,
        amount_cents: visitAmount > 0 ? visitAmount : estimate.amount_cents,
        source_estimate_id: estimate.id,
      })
      .select('id')
      .single();

    if (planError || !plan) {
      return {
        planId: null,
        recurringInvoiceId: null,
        error: planError?.message || 'Could not start the maintenance plan',
      };
    }
    planId = plan.id;

    await recordCustomerPlaceEvent(estimate.customer_id, {
      kind: 'maintenance_started',
      title: area ? `Maintenance started · ${area}` : 'Maintenance started',
      detail: `${MAINTENANCE_FREQUENCY_LABELS[frequency]} · #${label}`,
      estimateId: estimate.id,
      amountCents: estimate.amount_cents ?? 0,
      jobArea: area,
      ownerId: estimate.owner_id,
    });
  }

  const recurringFrequency = toRecurringInvoiceFrequency(frequency);
  let recurringInvoiceId: string | null = null;
  if (recurringFrequency && visitAmount > 0) {
    const { data: existingSchedule } = await supabase
      .from('pro_crm_recurring_invoices')
      .select('id')
      .eq('owner_id', estimate.owner_id)
      .eq('customer_id', estimate.customer_id)
      .eq('is_active', true)
      .eq('note', `Maintenance visits from estimate #${label}`)
      .maybeSingle();

    if (existingSchedule) {
      recurringInvoiceId = existingSchedule.id;
    } else {
      const { data: biz } = await supabase
        .from('businesses')
        .select('id')
        .eq('owner_id', estimate.owner_id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      const { data: schedule, error: scheduleError } = await supabase
        .from('pro_crm_recurring_invoices')
        .insert({
          owner_id: estimate.owner_id,
          customer_id: estimate.customer_id,
          business_id: biz?.id ?? null,
          frequency: recurringFrequency,
          next_run_date: nextVisit,
          end_date: null,
          is_active: true,
          amount_cents: visitAmount,
          line_items: (estimate.line_items ?? null) as Json | null,
          payment_terms: 'due_on_receipt',
          note: `Maintenance visits from estimate #${label}`,
        })
        .select('id')
        .single();

      if (scheduleError) {
        return {
          planId,
          recurringInvoiceId: null,
          error: scheduleError.message || 'Maintenance started; recurring invoices could not be scheduled',
        };
      }
      recurringInvoiceId = schedule?.id ?? null;
    }
  }

  return { planId, recurringInvoiceId, error: null };
}
