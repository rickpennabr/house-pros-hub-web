import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/supabase';
import { customerCanAcceptEstimate } from '@/lib/schemas/crmEstimate';
import { issueAcceptanceDeposit } from '@/lib/crm/estimate-deposit';
import { deliverDepositInvoice } from '@/lib/crm/deliver-deposit';
import { startMaintenanceFromEstimate } from '@/lib/crm/start-maintenance-from-estimate';
import { sendEstimateApprovalNotificationEmails } from '@/lib/services/emailService';
import { recordAdminBellEvent } from '@/lib/services/adminNotifications';
import { recordEstimateApproved } from '@/lib/places/timeline';

type Client = SupabaseClient<Database>;

export type AcceptEstimateResult =
  | {
      ok: true;
      status: 'approved' | 'already_accepted';
      depositInvoiceId: string | null;
      depositPaymentUrl: string | null;
      depositError: string | null;
      maintenancePlanId: string | null;
      maintenanceError: string | null;
    }
  | { ok: false; status: number; error: string };

export interface AcceptEstimateOptions {
  baseUrl: string;
  locale: string;
  /** Typed name shown as signature on the agreement. */
  signerName?: string | null;
  /** Optional stroke/data URL; defaults to the typed name. */
  signatureData?: string | null;
}

/**
 * Mark a sent estimate accepted, bill the deposit, email the payment link,
 * and start a maintenance plan when the agreement is a repeating service.
 */
export async function acceptSentEstimate(
  supabase: Client,
  estimateId: string,
  options: AcceptEstimateOptions
): Promise<AcceptEstimateResult> {
  const { data: estimate, error: estimateErr } = await supabase
    .from('pro_crm_estimates')
    .select(
      'id, status, display_id, amount_cents, owner_id, customer_id, job_area, agreement_kind, maintenance_frequency'
    )
    .eq('id', estimateId)
    .single();
  if (estimateErr || !estimate) return { ok: false, status: 404, error: 'Estimate not found' };
  if (estimate.status === 'accepted') {
    return {
      ok: true,
      status: 'already_accepted',
      depositInvoiceId: null,
      depositPaymentUrl: null,
      depositError: null,
      maintenancePlanId: null,
      maintenanceError: null,
    };
  }
  if (!customerCanAcceptEstimate(estimate.status)) {
    return { ok: false, status: 400, error: 'This estimate has not been sent for approval' };
  }
  if (estimate.agreement_kind === 'maintenance' && !estimate.maintenance_frequency) {
    return { ok: false, status: 400, error: 'This maintenance agreement is missing a visit schedule' };
  }

  const signerName = options.signerName?.trim().slice(0, 120) || null;
  const signatureData =
    options.signatureData?.trim().slice(0, 50_000) || signerName || null;

  const { error: updateErr } = await supabase
    .from('pro_crm_estimates')
    .update({
      status: 'accepted',
      signed_at: new Date().toISOString(),
      signer_name: signerName,
      signature_data: signatureData,
    })
    .eq('id', estimate.id);
  if (updateErr) return { ok: false, status: 500, error: updateErr.message || 'Failed to approve estimate' };

  const estimateNumber = String(estimate.display_id ?? estimate.id.slice(0, 8));
  const { data: customer } = await supabase
    .from('pro_crm_customers')
    .select('first_name, last_name, email')
    .eq('id', estimate.customer_id)
    .single();
  const customerName = [customer?.first_name, customer?.last_name].filter(Boolean).join(' ').trim() || 'Customer';
  const customerEmail = typeof customer?.email === 'string' && customer.email.trim() ? customer.email.trim() : null;

  const { data: biz } = await supabase
    .from('businesses')
    .select('business_name, email')
    .eq('owner_id', estimate.owner_id)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  const businessName = biz?.business_name ?? 'Your contractor';

  let contractorEmail: string | null = null;
  const { data: ownerUser, error: ownerErr } = await supabase.auth.admin.getUserById(estimate.owner_id);
  if (!ownerErr && ownerUser?.user?.email) contractorEmail = ownerUser.user.email.trim();
  if (!contractorEmail && typeof biz?.email === 'string' && biz.email.trim()) contractorEmail = biz.email.trim();

  void sendEstimateApprovalNotificationEmails({
    businessName,
    estimateNumber,
    amountCents: estimate.amount_cents ?? 0,
    customerName,
    customerEmail,
    contractorEmail,
  }).catch((error) => console.error('[acceptSentEstimate] approval emails failed', error));

  const amount = ((estimate.amount_cents ?? 0) / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
  await recordAdminBellEvent({
    eventType: 'estimate_accepted',
    entityType: 'estimate',
    entityId: estimate.id,
    displayName: customerName,
    detail: [`Estimate #${estimateNumber}`, businessName, amount].filter(Boolean).join(' · '),
  });

  await recordEstimateApproved({
    customerId: estimate.customer_id,
    estimateId: estimate.id,
    estimateNumber,
    amountCents: estimate.amount_cents ?? 0,
    jobArea: estimate.job_area,
    ownerId: estimate.owner_id,
  });

  const deposit = await issueAcceptanceDeposit(supabase, estimate.id, estimate.owner_id);
  let depositError = deposit.error ?? null;
  let depositPaymentUrl: string | null = null;
  if (deposit.invoiceId) {
    const delivery = await deliverDepositInvoice(supabase, deposit.invoiceId, options);
    if (delivery.error) depositError = delivery.error;
    depositPaymentUrl = delivery.viewUrl ?? null;
  }

  const maintenance = await startMaintenanceFromEstimate(supabase, estimate.id);

  return {
    ok: true,
    status: 'approved',
    depositInvoiceId: deposit.invoiceId,
    depositPaymentUrl,
    depositError,
    maintenancePlanId: maintenance.planId,
    maintenanceError: maintenance.error,
  };
}
