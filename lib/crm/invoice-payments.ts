import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/types/supabase';
import {
  activePaidCents,
  canRecordPayment,
  statusFromPayments,
  type PaymentMethod,
  type ProInvoiceStatus,
} from '@/lib/crm/invoice-books';

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
  }
) {
  const { data: invoice, error } = await supabase
    .from('pro_crm_invoices')
    .select('id, status, amount_cents, due_date')
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

  await writeEvent(supabase, {
    ownerId,
    invoiceId,
    actorId: ownerId,
    action: 'payment_recorded',
    payload: { payment_id: payment.id, amount_cents: input.amountCents, status },
  });

  return { payment, status, paymentAppliedCents: nextPaid };
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
