import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/types/supabase';
import { getNextInvoiceNumber } from '@/lib/crm/invoice-number';
import { buildProgressInvoice, contractBilledCents } from '@/lib/crm/progress-billing';

/**
 * When an estimate is accepted, bill its deposit as the first invoice.
 * Skips when there is no deposit or an invoice already holds part of the estimate.
 */
export async function issueAcceptanceDeposit(
  supabase: SupabaseClient<Database>,
  estimateId: string,
  ownerId: string
): Promise<{ invoiceId: string | null; error?: string }> {
  const { data: estimate, error } = await supabase
    .from('pro_crm_estimates')
    .select('id, owner_id, customer_id, amount_cents, line_items, note, deposit_cents')
    .eq('id', estimateId)
    .eq('owner_id', ownerId)
    .single();
  if (error || !estimate) return { invoiceId: null, error: 'Estimate not found' };

  const deposit = estimate.deposit_cents ?? 0;
  if (deposit <= 0) return { invoiceId: null };

  const { data: invoices, error: invoiceError } = await supabase
    .from('pro_crm_invoices')
    .select('status, amount_cents')
    .eq('owner_id', ownerId)
    .eq('estimate_id', estimateId);
  if (invoiceError) return { invoiceId: null, error: invoiceError.message };
  if (contractBilledCents(invoices ?? []) > 0) return { invoiceId: null };

  const progress = buildProgressInvoice({
    contractCents: estimate.amount_cents,
    billedCents: 0,
    requestedCents: deposit,
    lineItems: estimate.line_items,
    note: estimate.note,
    purpose: 'deposit',
  });
  if ('error' in progress) return { invoiceId: null, error: progress.error };

  const invoiceNumber = await getNextInvoiceNumber(supabase, ownerId);
  const { data: settings } = await supabase
    .from('pro_invoice_settings')
    .select('default_business_id')
    .eq('owner_id', ownerId)
    .maybeSingle();
  const today = new Date().toISOString().slice(0, 10);
  const { data: row, error: insertError } = await supabase
    .from('pro_crm_invoices')
    .insert({
      owner_id: ownerId,
      customer_id: estimate.customer_id,
      estimate_id: estimate.id,
      business_id: settings?.default_business_id ?? null,
      invoice_number: invoiceNumber,
      amount_cents: progress.amountCents,
      payment_applied_cents: 0,
      line_items: (progress.lineItems ?? null) as Json,
      status: 'draft',
      invoice_date: today,
      due_date: today,
      payment_terms: null,
      note: progress.note,
      converted_from_estimate_at: new Date().toISOString(),
      converted_from_estimate_by: ownerId,
    })
    .select('id')
    .single();
  if (insertError || !row) {
    return { invoiceId: null, error: insertError?.message || 'Could not create the deposit invoice' };
  }
  return { invoiceId: row.id };
}
