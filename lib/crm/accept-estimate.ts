import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/supabase';
import { customerCanAcceptEstimate } from '@/lib/schemas/crmEstimate';
import { issueAcceptanceDeposit } from '@/lib/crm/estimate-deposit';
import { deliverDepositInvoice } from '@/lib/crm/deliver-deposit';
import { sendEstimateApprovalNotificationEmails } from '@/lib/services/emailService';
import { recordAdminBellEvent } from '@/lib/services/adminNotifications';

type Client = SupabaseClient<Database>;

export type AcceptEstimateResult =
  | { ok: true; status: 'approved' | 'already_accepted'; depositInvoiceId: string | null; depositError: string | null }
  | { ok: false; status: number; error: string };

/**
 * Mark a sent estimate accepted, bill the deposit, and email the payment link.
 */
export async function acceptSentEstimate(
  supabase: Client,
  estimateId: string,
  options: { baseUrl: string; locale: string }
): Promise<AcceptEstimateResult> {
  const { data: estimate, error: estimateErr } = await supabase
    .from('pro_crm_estimates')
    .select('id, status, display_id, amount_cents, owner_id, customer_id')
    .eq('id', estimateId)
    .single();
  if (estimateErr || !estimate) return { ok: false, status: 404, error: 'Estimate not found' };
  if (estimate.status === 'accepted') {
    return { ok: true, status: 'already_accepted', depositInvoiceId: null, depositError: null };
  }
  if (!customerCanAcceptEstimate(estimate.status)) {
    return { ok: false, status: 400, error: 'This estimate has not been sent for approval' };
  }

  const { error: updateErr } = await supabase
    .from('pro_crm_estimates')
    .update({ status: 'accepted' })
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

  const deposit = await issueAcceptanceDeposit(supabase, estimate.id, estimate.owner_id);
  let depositError = deposit.error ?? null;
  if (deposit.invoiceId) {
    const delivery = await deliverDepositInvoice(supabase, deposit.invoiceId, options);
    if (delivery.error) depositError = delivery.error;
  }

  return {
    ok: true,
    status: 'approved',
    depositInvoiceId: deposit.invoiceId,
    depositError,
  };
}
