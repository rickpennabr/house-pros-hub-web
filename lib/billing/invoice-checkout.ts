import type { SupabaseClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';
import type { Database } from '@/lib/types/supabase';
import { canRecordPayment, todayDateKey, type ProInvoiceStatus } from '@/lib/crm/invoice-books';
import { recordInvoicePayment } from '@/lib/crm/invoice-payments';
import { getStripe } from '@/lib/billing/stripe';

type Client = SupabaseClient<Database>;

export function invoiceBalanceCents(amountCents: number, appliedCents: number): number {
  return Math.max(0, amountCents - appliedCents);
}

export function stripePaymentReference(sessionId: string): string {
  return `stripe:${sessionId}`;
}

/**
 * Start a card checkout for the open balance on an invoice.
 * The amount comes from the invoice, not from the browser.
 */
export async function createInvoiceCheckoutSession(
  supabase: Client,
  invoiceId: string,
  urls: { successUrl: string; cancelUrl: string }
): Promise<{ url: string } | { error: string }> {
  const { data: invoice, error } = await supabase
    .from('pro_crm_invoices')
    .select('id, owner_id, invoice_number, amount_cents, payment_applied_cents, status, business_id')
    .eq('id', invoiceId)
    .single();
  if (error || !invoice) return { error: 'Invoice not found' };
  if (invoice.status === 'cancelled') return { error: 'This invoice is cancelled' };
  if (invoice.status === 'draft') return { error: 'Send the invoice before taking a card payment' };
  if (!canRecordPayment(invoice.status as ProInvoiceStatus) && invoice.status !== 'paid') {
    return { error: 'This invoice cannot be paid online' };
  }

  const balance = invoiceBalanceCents(invoice.amount_cents, invoice.payment_applied_cents);
  if (balance <= 0) return { error: 'This invoice is already paid' };

  let businessName = 'House Pros Hub';
  if (invoice.business_id) {
    const { data: business } = await supabase
      .from('businesses')
      .select('business_name')
      .eq('id', invoice.business_id)
      .maybeSingle();
    if (business?.business_name) businessName = business.business_name;
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    success_url: urls.successUrl,
    cancel_url: urls.cancelUrl,
    client_reference_id: invoice.id,
    metadata: {
      product_kind: 'invoice_payment',
      invoice_id: invoice.id,
      owner_id: invoice.owner_id,
    },
    payment_intent_data: {
      metadata: {
        product_kind: 'invoice_payment',
        invoice_id: invoice.id,
        owner_id: invoice.owner_id,
      },
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: balance,
          product_data: {
            name: `Invoice ${invoice.invoice_number}`,
            description: businessName,
          },
        },
      },
    ],
  });
  if (!session.url) return { error: 'Stripe did not return a payment link' };
  return { url: session.url };
}

/**
 * Record a paid Checkout session on the invoice. Safe to call more than once.
 */
export async function applyInvoiceCheckoutSession(
  supabase: Client,
  session: Stripe.Checkout.Session
): Promise<{ ok: true } | { error: string }> {
  if (session.metadata?.product_kind !== 'invoice_payment') return { ok: true };
  if (session.payment_status !== 'paid') return { ok: true };
  const invoiceId = session.metadata.invoice_id;
  const ownerId = session.metadata.owner_id;
  if (!invoiceId || !ownerId) return { error: 'Checkout is missing the invoice' };

  const reference = stripePaymentReference(session.id);
  const { data: existing } = await supabase
    .from('pro_crm_invoice_payments')
    .select('id')
    .eq('invoice_id', invoiceId)
    .eq('reference', reference)
    .is('voided_at', null)
    .maybeSingle();
  if (existing) return { ok: true };

  const amount = session.amount_total;
  if (!amount || amount <= 0) return { error: 'Checkout has no amount' };

  const result = await recordInvoicePayment(
    supabase,
    ownerId,
    invoiceId,
    {
      amountCents: amount,
      paymentDate: todayDateKey(),
      method: 'card',
      reference,
      note: 'Paid online',
    },
    { baseUrl: process.env.NEXT_PUBLIC_APP_URL?.trim() || null, locale: 'en' }
  );
  if ('error' in result) {
    const { data: raced } = await supabase
      .from('pro_crm_invoice_payments')
      .select('id')
      .eq('invoice_id', invoiceId)
      .eq('reference', reference)
      .is('voided_at', null)
      .maybeSingle();
    if (raced) return { ok: true };
    return { error: result.error ?? 'Could not record payment' };
  }
  return { ok: true };
}
