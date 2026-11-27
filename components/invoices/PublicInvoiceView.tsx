'use client';

import { useEffect, useState } from 'react';
import { InvoiceTemplate } from '@/components/invoices/InvoiceTemplate';
import type { InvoiceTemplateInvoice, InvoiceTemplateCustomer, InvoiceTemplateBusiness } from '@/components/invoices/InvoiceTemplate';

interface PublicInvoiceViewProps {
  token: string | null;
  presentMode?: boolean;
  /** Back from card checkout on the invoice page. */
  paidReturn?: boolean;
  /** Inside the chat viewer: no full-page height and no print button. */
  embedded?: boolean;
  /** The pro looking from the chat: no Pay button. */
  readOnly?: boolean;
  /** Chat path to come back to after card checkout. */
  returnTo?: string | null;
}

/** Start card checkout for a public invoice and go to it. */
export async function startInvoiceCheckout(token: string, returnTo?: string | null): Promise<void> {
  const res = await fetch('/api/invoices/public/pay', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, returnTo: returnTo ?? undefined }),
  });
  const payload = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !payload.url) throw new Error(payload.error || 'Could not start payment');
  window.location.href = payload.url;
}

/** The customer's invoice from a public link: the /invoices/view page and the in-chat viewer. */
export function PublicInvoiceView({
  token,
  presentMode = false,
  paidReturn = false,
  embedded = false,
  readOnly = false,
  returnTo = null,
}: PublicInvoiceViewProps) {
  const [data, setData] = useState<{
    invoice: InvoiceTemplateInvoice;
    customer: InvoiceTemplateCustomer | null;
    business: InvoiceTemplateBusiness | null;
    themeColorHex: string;
    canPayByCard: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(token ? null : 'Missing link. Use the link from your invoice email.');
  const [loading, setLoading] = useState(Boolean(token));
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetch(`/api/invoices/public?token=${encodeURIComponent(token)}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((res) => {
        if (res.error) throw new Error(res.error);
        if (cancelled) return;
        setData({
          invoice: {
            invoice_number: res.invoiceNumber,
            amount_cents: res.amountCents,
            payment_applied_cents: res.paymentAppliedCents,
            line_items: res.lineItems,
            status: res.status,
            invoice_date: res.invoiceDate,
            due_date: res.dueDate,
            payment_terms: res.paymentTerms,
            po_number: res.poNumber ?? null,
            note: res.note,
          },
          customer: res.customer,
          business: res.business,
          themeColorHex: res.themeColorHex ?? '#000000',
          canPayByCard: res.canPayByCard === true,
        });
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load invoice');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const fill = embedded ? 'py-16' : 'min-h-screen';
  if (loading) return <div className={`${fill} flex items-center justify-center p-8 text-gray-500`}>Loading invoice…</div>;
  if (error || !data) {
    return (
      <div className={`${fill} flex items-center justify-center p-8`}>
        <div className="text-center max-w-md">
          <p className="text-red-600 font-medium">{error ?? 'Invoice not found.'}</p>
          <p className="text-sm text-gray-500 mt-2">Links expire after 30 days. Ask the sender for a new link.</p>
        </div>
      </div>
    );
  }

  const { invoice, customer, business, themeColorHex } = data;
  const displayCustomer: InvoiceTemplateCustomer = customer ?? { first_name: '', last_name: '', billing_address: null };
  const displayBusiness: InvoiceTemplateBusiness = business ?? { business_name: 'My Business', address: null };
  const balance = Math.max(0, invoice.amount_cents - (invoice.payment_applied_cents ?? 0));
  const owes = !readOnly && Boolean(token) && balance > 0 && invoice.status !== 'cancelled' && invoice.status !== 'draft';
  const canPay = owes && data.canPayByCard;

  async function pay() {
    if (!token) return;
    setPaying(true);
    setPayError(null);
    try {
      await startInvoiceCheckout(token, returnTo);
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'Could not start payment');
      setPaying(false);
    }
  }

  return (
    <div
      className={`bg-white px-4 print:py-0 print:px-0 ${embedded ? 'py-4' : 'min-h-screen py-8'} ${presentMode ? 'pt-0' : ''}`}
    >
      {presentMode ? (
        <div className="no-print mb-4 bg-black px-4 py-3 text-center text-sm font-medium text-white">
          Hand this device to the customer to pay by card.
        </div>
      ) : null}
      <div className="max-w-4xl mx-auto">
        <InvoiceTemplate
          invoice={invoice}
          customer={displayCustomer}
          business={displayBusiness}
          themeColor={themeColorHex}
          forPrint={false}
        />
        <div className="no-print mt-8 flex flex-col items-center gap-3">
          {paidReturn ? (
            <p className="text-sm text-gray-700">Payment submitted. The balance updates after the card payment is confirmed.</p>
          ) : null}
          {canPay ? (
            <button
              type="button"
              onClick={() => void pay()}
              disabled={paying}
              className="px-4 py-2 bg-black text-white rounded-lg font-medium hover:bg-gray-800 disabled:opacity-60"
            >
              {paying ? 'Starting payment…' : `Pay ${new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(balance / 100)}`}
            </button>
          ) : null}
          {owes && !data.canPayByCard ? (
            <p className="text-sm text-gray-700">Ask {data.business?.business_name || 'the business'} how to pay this invoice.</p>
          ) : null}
          {payError ? <p className="text-sm text-red-600">{payError}</p> : null}
          {!presentMode && !embedded ? (
            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 border-2 border-black rounded-lg font-medium"
            >
              Print
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
