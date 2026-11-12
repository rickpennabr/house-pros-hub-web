import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/types/supabase';
import {
  activePaidCents,
  canRecordPayment,
  PAYMENT_METHODS,
  statusFromPayments,
  todayDateKey,
  type PaymentMethod,
  type ProInvoiceStatus,
} from '@/lib/crm/invoice-books';
import { emailPaymentReceipt, type ReceiptResult } from '@/lib/crm/payment-receipt';

type Client = SupabaseClient<Database>;

async function loadPayments(supabase: Client, invoiceId: string) {
  const { data, error } = await supabase
    .from('pro_crm_invoice_payments')
    .select('id, amount_cents, voided_at')
    .eq('invoice_id', invoiceId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function writeEvent(
  supabase: Client,
  input: {
    ownerId: string;
    invoiceId: string;
    actorId: string;
    action: Database['public']['Tables']['pro_crm_document_events']['Insert']['action'];
    payload: Json;
  }
) {
  const { error } = await supabase.from('pro_crm_document_events').insert({
    owner_id: input.ownerId,
    invoice_id: input.invoiceId,
    actor_id: input.actorId,
    action: input.action,
    payload: input.payload,
  });
  if (error) throw new Error(error.message);
}

export async function recordInvoicePayment(
  supabase: Client,
  ownerId: string,
  invoiceId: string,
  input: {
    amountCents: number;
    paymentDate: string;
    method: PaymentMethod;
    reference: string | null;
    note: string | null;
  },
  options?: { baseUrl?: string | null; locale?: string }
) {
  const { data: invoice, error } = await supabase
    .from('pro_crm_invoices')
    .select('id, status, amount_cents, due_date, customer_id, business_id, invoice_number')
    .eq('id', invoiceId)
    .eq('owner_id', ownerId)
    .single();
  if (error || !invoice) return { error: 'Invoice not found' as const };
  if (!canRecordPayment(invoice.status)) {
    return { error: 'Send the invoice before recording a payment' as const };
  }
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    return { error: 'Enter a payment amount' as const };
  }

  const payments = await loadPayments(supabase, invoiceId);
  const paid = activePaidCents(payments);
  const balance = invoice.amount_cents - paid;
  if (input.amountCents > balance) {
    return { error: 'Payment is more than the balance due' as const };
  }

  const { data: payment, error: insertError } = await supabase
    .from('pro_crm_invoice_payments')
    .insert({
      owner_id: ownerId,
      invoice_id: invoiceId,
      amount_cents: input.amountCents,
      payment_date: input.paymentDate,
      method: input.method,
      reference: input.reference,
      note: input.note,
    })
    .select('id, amount_cents, payment_date, method, reference, note, voided_at, created_at')
    .single();
  if (insertError || !payment) return { error: insertError?.message || 'Could not record payment' };

  const nextPaid = paid + input.amountCents;
  const status = statusFromPayments({
    storedStatus: invoice.status,
    dueDate: invoice.due_date,
    totalCents: invoice.amount_cents,
    paidCents: nextPaid,
  });
  const { error: updateError } = await supabase
    .from('pro_crm_invoices')
    .update({ payment_applied_cents: nextPaid, status })
    .eq('id', invoiceId)
    .eq('owner_id', ownerId);
  if (updateError) return { error: updateError.message };

  const balanceCents = Math.max(0, invoice.amount_cents - nextPaid);
  const receipt: ReceiptResult = await emailPaymentReceipt({
    customerId: invoice.customer_id,
    businessId: invoice.business_id,
    invoiceId,
    invoiceNumber: invoice.invoice_number,
    paidCents: input.amountCents,
    balanceCents,
    method: input.method,
    baseUrl: options?.baseUrl ?? null,
    locale: options?.locale,
  });

  await writeEvent(supabase, {
    ownerId,
    invoiceId,
    actorId: ownerId,
    action: 'payment_recorded',
    payload: { payment_id: payment.id, amount_cents: input.amountCents, status, receipt },
  });

  return { payment, status, paymentAppliedCents: nextPaid, receipt };
}

export function parsePaidNow(body: {
  paidNow?: unknown;
  paidNowMethod?: unknown;
}): { paidNow: false } | { paidNow: true; method: PaymentMethod } | { error: string } {
  if (body.paidNow !== true) return { paidNow: false };
  const method = String(body.paidNowMethod ?? 'cash') as PaymentMethod;
  if (!PAYMENT_METHODS.includes(method)) return { error: 'Choose a payment method' };
  return { paidNow: true, method };
}

/** Mark a draft as sent and record a payment for whatever is still open. */
export async function settleInvoicePaidInFull(
  supabase: Client,
  ownerId: string,
  invoiceId: string,
  method: PaymentMethod,
  options?: { baseUrl?: string | null; locale?: string }
) {
  const { data: invoice, error } = await supabase
    .from('pro_crm_invoices')
    .select('id, status, amount_cents, payment_applied_cents')
    .eq('id', invoiceId)
    .eq('owner_id', ownerId)
    .single();
  if (error || !invoice) return { error: 'Invoice not found' as const };
  if (invoice.status === 'cancelled') return { error: 'This invoice is cancelled' as const };
  const balance = invoice.amount_cents - invoice.payment_applied_cents;
  if (balance <= 0) return { error: 'This invoice has nothing left to pay' as const };

  const wasDraft = invoice.status === 'draft';
  if (wasDraft) {
    const { error: sentError } = await supabase
      .from('pro_crm_invoices')
      .update({ status: 'sent' })
      .eq('id', invoiceId)
      .eq('owner_id', ownerId);
    if (sentError) return { error: sentError.message };
  }

  const result = await recordInvoicePayment(
    supabase,
    ownerId,
    invoiceId,
    {
      amountCents: balance,
      paymentDate: todayDateKey(),
      method,
      reference: null,
      note: 'Paid when the invoice was saved',
    },
    options
  );
  if ('error' in result && result.error) {
    if (wasDraft) {
      await supabase.from('pro_crm_invoices').update({ status: 'draft' }).eq('id', invoiceId).eq('owner_id', ownerId);
    }
    return { error: result.error };
  }
  return result;
}

export async function voidInvoicePayment(
  supabase: Client,
  ownerId: string,
  invoiceId: string,
  paymentId: string
) {
  const { data: invoice, error } = await supabase
    .from('pro_crm_invoices')
    .select('id, status, amount_cents, due_date')
    .eq('id', invoiceId)
    .eq('owner_id', ownerId)
    .single();
  if (error || !invoice) return { error: 'Invoice not found' as const };
  if (invoice.status === 'cancelled') return { error: 'This invoice is cancelled' as const };

  const { data: payment, error: paymentError } = await supabase
    .from('pro_crm_invoice_payments')
    .select('id, amount_cents, voided_at')
    .eq('id', paymentId)
    .eq('invoice_id', invoiceId)
    .eq('owner_id', ownerId)
    .single();
  if (paymentError || !payment) return { error: 'Payment not found' as const };
  if (payment.voided_at) return { error: 'This payment is already voided' as const };

  const { error: voidError } = await supabase
    .from('pro_crm_invoice_payments')
    .update({ voided_at: new Date().toISOString(), voided_by: ownerId })
    .eq('id', paymentId)
    .eq('owner_id', ownerId);
  if (voidError) return { error: voidError.message };

  const payments = await loadPayments(supabase, invoiceId);
  const nextPaid = activePaidCents(payments);
  const stored: ProInvoiceStatus = invoice.status === 'draft' ? 'sent' : invoice.status;
  const status = statusFromPayments({
    storedStatus: stored,
    dueDate: invoice.due_date,
    totalCents: invoice.amount_cents,
    paidCents: nextPaid,
  });
  const { error: updateError } = await supabase
    .from('pro_crm_invoices')
    .update({ payment_applied_cents: nextPaid, status })
    .eq('id', invoiceId)
    .eq('owner_id', ownerId);
  if (updateError) return { error: updateError.message };

  await writeEvent(supabase, {
    ownerId,
    invoiceId,
    actorId: ownerId,
    action: 'payment_voided',
    payload: { payment_id: paymentId, amount_cents: payment.amount_cents, status },
  });

  return { status, paymentAppliedCents: nextPaid };
}
