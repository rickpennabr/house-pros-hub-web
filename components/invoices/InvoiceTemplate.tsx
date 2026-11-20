'use client';

import { formatInvoiceDueDisplay } from '@/lib/invoices/invoiceDueOnReceipt';
import { contactDisplayName } from '@/lib/crm/contact-name';
import { DocumentBrandHeader } from '@/components/documents/DocumentBrandHeader';

export interface InvoiceLineItem {
  product_or_service?: string | null;
  description?: string | null;
  unit?: string | null;
  qty: number;
  rate_cents: number;
  amount_cents: number;
}

export interface InvoiceTemplateInvoice {
  invoice_number: string;
  amount_cents: number;
  payment_applied_cents?: number;
  line_items: InvoiceLineItem[] | null;
  status: 'draft' | 'sent' | 'partial' | 'paid' | 'overdue' | 'cancelled';
  invoice_date: string;
  due_date: string | null;
  payment_terms?: string | null;
  note?: string | null;
}

export interface InvoiceTemplateCustomer {
  first_name: string;
  last_name: string;
  /** Customer display name (name shown on forms/invoices). Preferred for invoice "Bill to". */
  display_name?: string | null;
  company_name?: string | null;
  /** Single-line or multi-line bill-to address */
  billing_address?: string | null;
  /** Or use components */
  street_address?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
}

export interface InvoiceTemplateBusiness {
  business_name: string;
  business_logo?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  /** Single-line or multi-line address */
  address?: string | null;
  company_tagline?: string | null;
  /** Footer from invoice settings: payment instructions, terms and conditions. */
  invoice_footer?: string | null;
}

interface InvoiceTemplateProps {
  invoice: InvoiceTemplateInvoice;
  customer: InvoiceTemplateCustomer;
  business: InvoiceTemplateBusiness;
  themeColor: string;
  /** For print: hide non-content UI */
  forPrint?: boolean;
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function getCustomerAddress(c: InvoiceTemplateCustomer): string {
  if (c.billing_address?.trim()) return c.billing_address.trim();
  const parts = [
    c.street_address,
    [c.city, c.state, c.zip_code].filter(Boolean).join(', '),
  ].filter(Boolean);
  return parts.join('\n') || '—';
}

export function InvoiceTemplate({
  invoice,
  customer,
  business,
  themeColor,
  forPrint = false,
}: InvoiceTemplateProps) {
  const paymentApplied = invoice.payment_applied_cents ?? 0;
  const balanceDue = Math.max(0, invoice.amount_cents - paymentApplied);
  const lineItems: InvoiceLineItem[] = Array.isArray(invoice.line_items)
    ? invoice.line_items
    : [];
  const isOverdue =
    invoice.status === 'overdue' ||
    (invoice.status === 'sent' && invoice.due_date && new Date(invoice.due_date) < new Date());

  const tintBg = themeColor && themeColor !== '#000000'
    ? `${themeColor}14`
    : 'rgba(0,0,0,0.06)';

  const customerAddress = getCustomerAddress(customer);
  const businessAddress = business.address ?? '';

  return (
    <div className={`bg-white text-black ${forPrint ? 'print-invoice' : ''}`} style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
      <DocumentBrandHeader
        title="INVOICE"
        themeColor={themeColor}
        business={{
          ...business,
          address: businessAddress || business.address || null,
        }}
        className="mb-8 pb-6"
      />

      {/* Tinted block: Bill To + Invoice details */}
      <div
        className="rounded-lg p-5 mb-8"
        style={{ backgroundColor: tintBg }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-1">Bill to</p>
            <p className="font-semibold text-black">
              {contactDisplayName(customer)}
            </p>
            {customerAddress && (
              <p className="text-sm text-gray-700 mt-1 whitespace-pre-line">{customerAddress}</p>
            )}
          </div>
          <div className="border-t border-gray-300 md:border-t-0 md:border-l md:pl-6 pt-4 md:pt-0">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <span className="text-gray-600">Invoice no.</span>
              <span className="font-semibold">{invoice.invoice_number}</span>
              <span className="text-gray-600">Invoice date</span>
              <span>{formatDate(invoice.invoice_date)}</span>
              <span className="text-gray-600">Due date</span>
              <span>
                {formatInvoiceDueDisplay(
                  invoice.invoice_date,
                  invoice.due_date,
                  invoice.payment_terms,
                  formatDate
                )}
              </span>
              {invoice.payment_terms && (
                <>
                  <span className="text-gray-600">Terms</span>
                  <span>{invoice.payment_terms}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Line items table */}
      <div className="overflow-x-auto mb-8">
        <table className="w-full border-collapse" style={{ minWidth: 520 }}>
          <thead>
            <tr className="border-b-2 border-black">
              <th className="text-left py-2 px-3 text-xs font-semibold uppercase text-gray-600 w-10">#</th>
              <th className="text-left py-2 px-3 text-xs font-semibold uppercase text-gray-600">Product or service</th>
              <th className="text-left py-2 px-3 text-xs font-semibold uppercase text-gray-600">Description</th>
              <th className="text-left py-2 px-3 text-xs font-semibold uppercase text-gray-600 w-16">Unit</th>
              <th className="text-right py-2 px-3 text-xs font-semibold uppercase text-gray-600 min-w-[5.5rem] w-[5.5rem]">Qty</th>
              <th className="text-right py-2 px-3 text-xs font-semibold uppercase text-gray-600 min-w-[7rem] w-[7rem]">Rate</th>
              <th className="text-right py-2 px-3 text-xs font-semibold uppercase text-gray-600 w-28">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-6 text-center text-gray-500 text-sm">
                  No line items
                </td>
              </tr>
            ) : (
              lineItems.map((line, i) => (
                <tr key={i} className="border-b border-gray-200">
                  <td className="py-2 px-3 text-sm text-gray-600">{i + 1}</td>
                  <td className="py-2 px-3 font-medium text-black">{line.product_or_service || '—'}</td>
                  <td className="py-2 px-3 text-sm text-gray-700">{line.description || '—'}</td>
                  <td className="py-2 px-3 text-sm text-gray-600">{line.unit || '—'}</td>
                  <td className="py-2 px-3 text-sm text-right">{line.qty}</td>
                  <td className="py-2 px-3 text-sm text-right">{formatCurrency(line.rate_cents)}</td>
                  <td className="py-2 px-3 text-sm text-right">{formatCurrency(line.amount_cents)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Totals + Status */}
      <div className="flex flex-col items-end gap-2 mb-6">
        <div className="w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span>{formatCurrency(invoice.amount_cents)}</span>
          </div>
          {paymentApplied > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>Payment</span>
              <span>-{formatCurrency(paymentApplied)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base pt-2 border-t-2 border-black">
            <span>Balance due</span>
            <span>{formatCurrency(balanceDue)}</span>
          </div>
        </div>
        <div className="mt-2">
          {invoice.status === 'paid' && (
            <span className="inline-block px-3 py-1 rounded font-bold text-sm text-white bg-green-600">
              Paid in Full
            </span>
          )}
          {invoice.status === 'overdue' && (
            <span className="inline-block px-3 py-1 rounded font-bold text-sm text-white bg-amber-600">
              Overdue
            </span>
          )}
          {isOverdue && invoice.status === 'sent' && (
            <span className="inline-block px-3 py-1 rounded font-bold text-sm text-white bg-amber-600">
              Overdue
            </span>
          )}
          {invoice.status === 'draft' && (
            <span className="inline-block px-3 py-1 rounded font-bold text-sm bg-gray-200 text-gray-700">
              Draft
            </span>
          )}
          {invoice.status === 'sent' && !isOverdue && (
            <span className="inline-block px-3 py-1 rounded font-bold text-sm bg-blue-100 text-blue-800">
              Sent
            </span>
          )}
          {invoice.status === 'partial' && (
            <span className="inline-block px-3 py-1 rounded font-bold text-sm bg-blue-100 text-blue-800">
              Partial
            </span>
          )}
          {invoice.status === 'cancelled' && (
            <span className="inline-block px-3 py-1 rounded font-bold text-sm bg-gray-200 text-gray-700">
              Cancelled
            </span>
          )}
        </div>
      </div>

      {invoice.note && (
        <div className="pt-4 border-t border-gray-200">
          <p className="text-xs font-semibold uppercase text-gray-600 mb-1">Note</p>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{invoice.note}</p>
        </div>
      )}

      {business.invoice_footer && (
        <div className="pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-600 whitespace-pre-wrap">{business.invoice_footer}</p>
        </div>
      )}
    </div>
  );
}
