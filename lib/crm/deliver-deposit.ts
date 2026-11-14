import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/supabase';
import { sendInvoiceEmail } from '@/lib/services/emailService';

type Client = SupabaseClient<Database>;

const DEPOSIT_MESSAGE =
  'This deposit covers materials, delivery, and labor so the job can start. Open the invoice to pay by card. The rest is billed when the work is finished, or in stages on a larger job.';

/**
 * Mark a deposit invoice as sent and email the customer a link they can pay.
 * A missing email still leaves the invoice visible in My Places.
 */
export async function deliverDepositInvoice(
  supabase: Client,
  invoiceId: string,
  options: { baseUrl: string; locale: string }
): Promise<{ emailed: boolean; error?: string }> {
  const { data: invoice, error } = await supabase
    .from('pro_crm_invoices')
    .select('id, owner_id, customer_id, invoice_number, amount_cents, status, business_id')
    .eq('id', invoiceId)
    .single();
  if (error || !invoice) return { emailed: false, error: 'Deposit invoice not found' };
  if (invoice.status === 'cancelled' || invoice.status === 'paid') return { emailed: false };

  if (invoice.status === 'draft') {
    const { error: statusError } = await supabase
      .from('pro_crm_invoices')
      .update({ status: 'sent' })
      .eq('id', invoice.id);
    if (statusError) return { emailed: false, error: statusError.message };
  }

  const { data: customer } = await supabase
    .from('pro_crm_customers')
    .select('email')
    .eq('id', invoice.customer_id)
    .single();
  const toEmail = customer?.email?.trim();
  if (!toEmail) return { emailed: false };

  let businessName = 'Your pro';
  if (invoice.business_id) {
    const { data: business } = await supabase
      .from('businesses')
      .select('business_name')
      .eq('id', invoice.business_id)
      .single();
    if (business?.business_name) businessName = business.business_name;
  } else {
    const { data: business } = await supabase
      .from('businesses')
      .select('business_name')
      .eq('owner_id', invoice.owner_id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    if (business?.business_name) businessName = business.business_name;
  }

  const { data: tokenRow, error: tokenError } = await supabase
    .from('pro_invoice_view_tokens')
    .insert({
      invoice_id: invoice.id,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select('token')
    .single();
  if (tokenError || !tokenRow) return { emailed: false, error: tokenError?.message || 'Could not create a payment link' };

  const viewUrl = `${options.baseUrl}/${options.locale}/invoices/view?token=${tokenRow.token}`;
  const email = await sendInvoiceEmail(
    {
      businessName,
      invoiceNumber: invoice.invoice_number,
      amountCents: invoice.amount_cents,
      viewUrl,
      message: DEPOSIT_MESSAGE,
    },
    toEmail
  );
  if (!email.success) return { emailed: false, error: email.error };
  return { emailed: true };
}
