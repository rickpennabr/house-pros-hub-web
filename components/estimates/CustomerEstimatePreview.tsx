'use client';

import { useMemo } from 'react';
import { contactDisplayName } from '@/lib/crm/contact-name';

export interface CustomerEstimatePreviewData {
  estimateId: string;
  estimateNumber: string | null;
  amountCents: number;
  lineItems: unknown;
  status: 'draft' | 'sent' | 'accepted' | 'declined';
  validUntilDate: string | null;
  note: string | null;
  customer: {
    first_name: string | null;
    last_name: string | null;
    display_name: string | null;
    company_name: string | null;
    email: string | null;
  } | null;
  business: {
    business_name: string;
    business_logo: string | null;
    email: string | null;
    phone: string | null;
  } | null;
}

interface PublicEstimateLineItem {
  product_or_service?: string;
  description?: string;
  qty?: number;
  unit?: string;
  rate_cents?: number;
  amount_cents?: number;
}

function asLineItems(value: unknown): PublicEstimateLineItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter((line): line is PublicEstimateLineItem => Boolean(line && typeof line === 'object'));
}

function formatAmount(cents: number) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);
}

interface CustomerEstimatePreviewProps {
  data: CustomerEstimatePreviewData;
  variant: 'public' | 'preview';
  /** Public link only */
  onApprove?: () => void;
  approveLoading?: boolean;
  alreadyAccepted?: boolean;
  approveMessage?: string | null;
}

/**
 * Customer-facing estimate document — same layout as the public /estimates/view page.
 */
export function CustomerEstimatePreview({
  data,
  variant,
  onApprove,
  approveLoading = false,
  alreadyAccepted = false,
  approveMessage = null,
}: CustomerEstimatePreviewProps) {
  const lineItems = useMemo(() => asLineItems(data.lineItems), [data.lineItems]);

  const displayName = data.customer ? contactDisplayName(data.customer) : 'Customer';

  return (
    <div className={variant === 'preview' ? 'bg-white' : 'min-h-screen bg-gray-50 py-8 px-4'}>
      <div
        className={
          variant === 'preview'
            ? 'max-w-4xl mx-auto bg-white border-2 border-black rounded-lg overflow-hidden'
            : 'max-w-4xl mx-auto bg-white border-2 border-black rounded-lg overflow-hidden'
        }
      >
        {variant === 'preview' && (
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-sm text-amber-900">
            <strong>Customer preview</strong> — This is how your estimate appears to the customer (they will see an Approve button on the live link).
          </div>
        )}
        <div className="p-6 border-b-2 border-black flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-black">ESTIMATE</h1>
            <p className="text-sm text-gray-600 mt-1">
              From {data.business?.business_name || 'Business'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Estimate #</p>
            <p className="font-semibold">{data.estimateNumber || data.estimateId.slice(0, 8)}</p>
            <p className="text-xs text-gray-500 mt-2">Total</p>
            <p className="font-bold text-lg">{formatAmount(data.amountCents)}</p>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Customer</p>
              <p className="font-medium">{displayName}</p>
            </div>
            <div>
              <p className="text-gray-500">Valid until</p>
              <p className="font-medium">
                {data.validUntilDate
                  ? new Date(data.validUntilDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                  : '—'}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full min-w-[640px]">
              <thead className="bg-gray-100">
                <tr className="text-xs uppercase text-gray-600">
                  <th className="px-3 py-2 text-left">Product or service</th>
                  <th className="px-3 py-2 text-left">Description</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-left">Unit</th>
                  <th className="px-3 py-2 text-right">Rate</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-gray-500 text-sm">No line items</td>
                  </tr>
                ) : (
                  lineItems.map((line, index) => (
                    <tr key={index} className="border-t border-gray-100 text-sm">
                      <td className="px-3 py-2">{line.product_or_service || '—'}</td>
                      <td className="px-3 py-2">{line.description || '—'}</td>
                      <td className="px-3 py-2 text-right">{line.qty ?? '—'}</td>
                      <td className="px-3 py-2">{line.unit || '—'}</td>
                      <td className="px-3 py-2 text-right">{typeof line.rate_cents === 'number' ? formatAmount(line.rate_cents) : '—'}</td>
                      <td className="px-3 py-2 text-right">{typeof line.amount_cents === 'number' ? formatAmount(line.amount_cents) : '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {data.note && (
            <div>
              <p className="text-xs uppercase text-gray-500 font-semibold">Note</p>
              <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{data.note}</p>
            </div>
          )}
        </div>

        {variant === 'public' && (
          <>
            <div className="p-6 border-t border-gray-200 bg-gray-50 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="text-sm">
                <span className="text-gray-500 mr-2">Status:</span>
                <span className={`font-semibold ${data.status === 'accepted' ? 'text-green-700' : 'text-gray-800'}`}>
                  {data.status}
                </span>
              </div>
              <button
                type="button"
                onClick={onApprove}
                disabled={approveLoading || alreadyAccepted}
                className="px-4 py-2 bg-black text-white rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {alreadyAccepted ? 'Approved' : approveLoading ? 'Approving...' : 'Approve Estimate'}
              </button>
            </div>
            {approveMessage && (
              <div
                className={`px-6 pb-6 text-sm ${
                  approveMessage.toLowerCase().includes('failed') ||
                  approveMessage.toLowerCase().includes('expired') ||
                  approveMessage.toLowerCase().includes('invalid')
                    ? 'text-red-600'
                    : 'text-green-700'
                }`}
              >
                {approveMessage}
              </div>
            )}
          </>
        )}

        {variant === 'preview' && (
          <div className="p-6 border-t border-gray-200 bg-gray-50 text-sm text-gray-600">
            <span className="text-gray-500 mr-2">Status on live link:</span>
            <span className="font-semibold text-gray-800">{data.status}</span>
            <span className="block mt-2 text-xs">The customer can approve from the secure link in their email.</span>
          </div>
        )}
      </div>
    </div>
  );
}
