import { getDefaultCompanyForInvoice } from '@/lib/invoices/defaultCompany';
import type { SupabaseClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';
import type { Database, Json } from '@/lib/types/supabase';
import { canRecordPayment, todayDateKey, type ProInvoiceStatus } from '@/lib/crm/invoice-books';
import { recordInvoicePayment, voidInvoicePayment } from '@/lib/crm/invoice-payments';
import { getStripe } from '@/lib/billing/stripe';
import { connectAccountFor, platformFeeCents } from '@/lib/billing/connect';
import { resolvePublicSiteUrl } from '@/lib/utils/publicSiteUrl';

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
    .select('id, owner_id, invoice_number, amount_cents, payment_applied_cents, status, business_id, customer_id')
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

  // The money goes to the pro's own Stripe account (Connect). Not set up: no card payment at all.
  const connect = await connectAccountFor(supabase, invoice.owner_id, invoice.business_id);
  if (!connect) return { error: 'This pro does not take card payments yet' };
  const fee = platformFeeCents(balance);

  let businessName = 'House Pros Hub';
  if (invoice.business_id) {
    const { data: business } = await supabase
      .from('businesses')
      .select('business_name')
      .eq('id', invoice.business_id)
      .maybeSingle();
    if (business?.business_name) businessName = business.business_name;
  } else {
    // No business on the invoice: use the pro's default invoice company.
    const fallback = await getDefaultCompanyForInvoice(supabase as never, invoice.owner_id);
    if (fallback?.business_name) businessName = fallback.business_name;
  }

  // Prefill the customer's email on the Stripe page (they can still change it).
  const { data: customer } = await supabase
    .from('pro_crm_customers')
    .select('email')
    .eq('id', invoice.customer_id)
    .maybeSingle();
  const customerEmail = customer?.email?.trim() || undefined;

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    success_url: urls.successUrl,
    cancel_url: urls.cancelUrl,
    client_reference_id: invoice.id,
    ...(customerEmail ? { customer_email: customerEmail } : {}),
    metadata: {
      product_kind: 'invoice_payment',
      invoice_id: invoice.id,
      owner_id: invoice.owner_id,
    },
    payment_intent_data: {
      on_behalf_of: connect.stripe_account_id,
      transfer_data: { destination: connect.stripe_account_id },
      ...(fee > 0 ? { application_fee_amount: fee } : {}),
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

/** "Today" for the invoice in the business's time zone (not the server's). */
async function invoiceToday(supabase: Client, invoiceId: string): Promise<string> {
  const { data: invoice } = await supabase.from('pro_crm_invoices').select('business_id').eq('id', invoiceId).maybeSingle();
  let timeZone = 'America/Los_Angeles';
  if (invoice?.business_id) {
    const { data: business } = await supabase.from('businesses').select('timezone').eq('id', invoice.business_id).maybeSingle();
    if (business?.timezone) timeZone = business.timezone;
  }
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  } catch {
    return todayDateKey();
  }
}

async function findStripePayment(supabase: Client, invoiceId: string, reference: string) {
  const { data } = await supabase
    .from('pro_crm_invoice_payments')
    .select('id, amount_cents')
    .eq('invoice_id', invoiceId)
    .eq('reference', reference)
    .is('voided_at', null)
    .maybeSingle();
  return data;
}

/**
 * Record a paid Checkout session on the invoice. Safe to call more than once.
 * If the balance dropped while the customer was paying (the pro recorded cash meanwhile), only the
 * balance is recorded and the extra is refunded to the card right away.
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
  if (await findStripePayment(supabase, invoiceId, reference)) return { ok: true };

  const amount = session.amount_total;
  if (!amount || amount <= 0) return { error: 'Checkout has no amount' };

  const { data: invoice } = await supabase
    .from('pro_crm_invoices')
    .select('amount_cents, payment_applied_cents')
    .eq('id', invoiceId)
    .maybeSingle();
  const balance = invoice ? invoiceBalanceCents(invoice.amount_cents, invoice.payment_applied_cents) : amount;
  const recordCents = Math.min(amount, balance);
  const extraCents = amount - recordCents;

  if (extraCents > 0) {
    const paymentIntent = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
    if (paymentIntent) {
      await getStripe()
        .refunds.create(
          { payment_intent: paymentIntent, amount: extraCents, reverse_transfer: true, refund_application_fee: true, metadata: { reason: 'invoice_overpaid', invoice_id: invoiceId } },
          { idempotencyKey: `overpaid-${session.id}` }
        )
        .catch((error) => console.error('invoice overpay refund', error instanceof Error ? error.message : error));
    }
    await supabase.from('pro_crm_document_events').insert({
      owner_id: ownerId,
      invoice_id: invoiceId,
      actor_id: ownerId,
      action: 'payment_recorded',
      payload: { kind: 'card_overpaid_refunded', refunded_cents: extraCents, reference } as Json,
    });
  }
  if (recordCents <= 0) return { ok: true };

  const result = await recordInvoicePayment(
    supabase,
    ownerId,
    invoiceId,
    {
      amountCents: recordCents,
      paymentDate: await invoiceToday(supabase, invoiceId),
      method: 'card',
      reference,
      note: extraCents > 0 ? `Paid online (${(extraCents / 100).toFixed(2)} over the balance was refunded)` : 'Paid online',
    },
    { baseUrl: resolvePublicSiteUrl(null), locale: 'en' }
  );
  if ('error' in result) {
    if (await findStripePayment(supabase, invoiceId, reference)) return { ok: true };
    return { error: result.error ?? 'Could not record payment' };
  }
  return { ok: true };
}

/**
 * A card payment was refunded in Stripe, or a dispute was lost: take it off the invoice.
 * Our own overpay refund does not count. If part of the money is kept, that part stays recorded.
 */
export async function applyInvoiceChargeReversal(
  supabase: Client,
  charge: Stripe.Charge,
  lostDispute = false
): Promise<{ ok: true } | { error: string }> {
  const paymentIntent = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
  if (!paymentIntent) return { ok: true };
  const sessions = await getStripe().checkout.sessions.list({ payment_intent: paymentIntent, limit: 1 });
  const session = sessions.data[0];
  if (!session || session.metadata?.product_kind !== 'invoice_payment') return { ok: true };
  const invoiceId = session.metadata.invoice_id;
  const ownerId = session.metadata.owner_id;
  if (!invoiceId || !ownerId) return { ok: true };

  const reference = stripePaymentReference(session.id);
  const recorded = await findStripePayment(supabase, invoiceId, reference);
  if (!recorded) return { ok: true };

  const kept = lostDispute ? 0 : Math.max(0, charge.amount - charge.amount_refunded);
  // Still keeping at least what is recorded (e.g. only our overpay refund happened): nothing to do.
  if (kept >= recorded.amount_cents) return { ok: true };

  const voided = await voidInvoicePayment(supabase, ownerId, invoiceId, recorded.id);
  if ('error' in voided) return { error: voided.error ?? 'Could not void payment' };
  if (kept > 0) {
    await recordInvoicePayment(supabase, ownerId, invoiceId, {
      amountCents: kept,
      paymentDate: await invoiceToday(supabase, invoiceId),
      method: 'card',
      reference: `${reference}:net`,
      note: 'Paid online (part refunded in Stripe)',
    });
  }
  return { ok: true };
}
