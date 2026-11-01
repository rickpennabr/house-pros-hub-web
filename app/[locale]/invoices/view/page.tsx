'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { InvoiceTemplate } from '@/components/invoices/InvoiceTemplate';
import type { InvoiceTemplateInvoice, InvoiceTemplateCustomer, InvoiceTemplateBusiness } from '@/components/invoices/InvoiceTemplate';

function InvoiceViewContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [data, setData] = useState<{
    invoice: InvoiceTemplateInvoice;
    customer: InvoiceTemplateCustomer | null;
    business: InvoiceTemplateBusiness | null;
    themeColorHex: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setError('Missing link. Use the link from your invoice email.');
      setLoading(false);
      return;
    }
    fetch(`/api/invoices/public?token=${encodeURIComponent(token)}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((res) => {
        if (res.error) throw new Error(res.error);
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
            note: res.note,
          },
          customer: res.customer,
          business: res.business,
          themeColorHex: res.themeColorHex ?? '#000000',
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load invoice'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="min-h-screen flex items-center justify-center p-8 text-gray-500">Loading invoice…</div>;
  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
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

  return (
    <div className="min-h-screen bg-white py-8 px-4 print:py-0 print:px-0">
      <div className="max-w-4xl mx-auto">
        <InvoiceTemplate
          invoice={invoice}
          customer={displayCustomer}
          business={displayBusiness}
          themeColor={themeColorHex}
          forPrint={false}
        />
        <div className="no-print mt-8 text-center">
          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 bg-black text-white rounded-lg font-medium hover:bg-gray-800"
          >
            Print
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PublicInvoiceViewPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center p-8 text-gray-500">Loading…</div>}>
      <InvoiceViewContent />
    </Suspense>
  );
}
