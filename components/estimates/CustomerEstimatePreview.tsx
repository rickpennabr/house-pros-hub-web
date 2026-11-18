'use client';

import { useMemo, useState } from 'react';
import { contactDisplayName } from '@/lib/crm/contact-name';
import { DocumentBrandHeader } from '@/components/documents/DocumentBrandHeader';
import { DOCUMENT_FORM_LAYOUT } from '@/lib/constants/documentFormLayout';
import {
  AGREEMENT_KIND_LABELS,
  MAINTENANCE_FREQUENCY_LABELS,
  type AgreementKind,
  type MaintenanceFrequency,
} from '@/lib/crm/estimate-agreement';

export interface CustomerEstimatePreviewData {
  estimateId: string;
  estimateNumber: string | null;
  amountCents: number;
  depositCents?: number;
  lineItems: unknown;
  status: 'draft' | 'sent' | 'accepted' | 'declined';
  validUntilDate: string | null;
  note: string | null;
  jobArea?: string | null;
  agreementKind?: AgreementKind | string | null;
  maintenanceFrequency?: MaintenanceFrequency | string | null;
  signedAt?: string | null;
  signerName?: string | null;
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
    website?: string | null;
    address?: string | null;
    company_tagline?: string | null;
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

function agreementLabel(kind: string | null | undefined) {
  if (!kind) return AGREEMENT_KIND_LABELS.project;
  return AGREEMENT_KIND_LABELS[kind as AgreementKind] ?? kind;
}

function frequencyLabel(frequency: string | null | undefined) {
  if (!frequency) return null;
  return MAINTENANCE_FREQUENCY_LABELS[frequency as MaintenanceFrequency] ?? frequency;
}

interface CustomerEstimatePreviewProps {
  data: CustomerEstimatePreviewData;
  variant: 'public' | 'preview' | 'portal';
  /** Present-on-device mode (tablet handoff). */
  presentMode?: boolean;
  /** Shown inside the chat viewer panel, not as a full page. */
  embedded?: boolean;
  onApprove?: (input: { signerName: string }) => void;
  approveLoading?: boolean;
  alreadyAccepted?: boolean;
  approveMessage?: string | null;
}

/**
 * Customer-facing agreement document — public link, CRM preview, and My Places.
 */
export function CustomerEstimatePreview({
  data,
  variant,
  presentMode = false,
  embedded = false,
  onApprove,
  approveLoading = false,
  alreadyAccepted = false,
  approveMessage = null,
}: CustomerEstimatePreviewProps) {
  const lineItems = useMemo(() => asLineItems(data.lineItems), [data.lineItems]);
  const [signerName, setSignerName] = useState('');
  const displayName = data.customer ? contactDisplayName(data.customer) : 'Customer';
  const kind = data.agreementKind || 'project';
  const schedule = frequencyLabel(data.maintenanceFrequency);
  const canApprove = data.status === 'sent' && !alreadyAccepted;
  const showApprove = variant === 'public' || variant === 'portal';
  const title =
    kind === 'maintenance'
      ? 'MAINTENANCE AGREEMENT'
      : kind === 'repair'
        ? 'REPAIR ESTIMATE'
        : kind === 'renovation' || kind === 'remodel' || kind === 'addition'
          ? 'PROJECT ESTIMATE'
          : 'ESTIMATE';

  return (
    <div
      className={
        variant === 'preview'
          ? 'bg-white'
          : embedded
            ? 'bg-gray-50 p-3 sm:p-4'
            : presentMode
            ? 'min-h-screen bg-white py-4 px-3'
            : 'min-h-screen bg-gray-50 py-8 px-4'
      }
    >
      <div className="max-w-4xl mx-auto bg-white border-2 border-black rounded-lg overflow-hidden">
        {variant === 'preview' ? (
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 text-sm text-amber-900">
            <strong>Customer preview</strong> — This is how the agreement appears when you present or send it.
          </div>
        ) : null}
        {presentMode ? (
          <div className="px-4 py-2 bg-black text-white text-sm font-medium">
            Hand this device to the customer to review, sign, and approve.
          </div>
        ) : null}

        <div className={`${DOCUMENT_FORM_LAYOUT.contentPaddingX} pt-6`}>
          <DocumentBrandHeader
            title={title}
            business={data.business}
            subtitle={agreementLabel(kind)}
            className="pb-6"
            rightMeta={
              <>
                <p className="text-xs text-gray-500">Document #</p>
                <p className="font-semibold">{data.estimateNumber || data.estimateId.slice(0, 8)}</p>
                <p className="mt-2 text-xs text-gray-500">Total</p>
                <p className="text-lg font-bold">{formatAmount(data.amountCents)}</p>
                {(data.depositCents ?? 0) > 0 ? (
                  <>
                    <p className="mt-2 text-xs text-gray-500">Due on approval</p>
                    <p className="font-semibold">{formatAmount(data.depositCents ?? 0)}</p>
                  </>
                ) : null}
              </>
            }
          />
        </div>

        <div className="p-6 space-y-4">
          <div className="grid gap-4 rounded-lg bg-gray-100 p-4 text-sm md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Customer</p>
              <p className="font-medium text-black">{displayName}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Valid until</p>
              <p className="font-medium text-black">
                {data.validUntilDate
                  ? new Date(data.validUntilDate).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })
                  : '—'}
              </p>
            </div>
            {data.jobArea ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Job area</p>
                <p className="font-medium text-black">{data.jobArea}</p>
              </div>
            ) : null}
            {schedule ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Maintenance schedule</p>
                <p className="font-medium text-black">{schedule}</p>
              </div>
            ) : null}
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
                    <td colSpan={6} className="px-3 py-6 text-center text-gray-500 text-sm">
                      No line items
                    </td>
                  </tr>
                ) : (
                  lineItems.map((line, index) => (
                    <tr key={index} className="border-t border-gray-100 text-sm">
                      <td className="px-3 py-2">{line.product_or_service || '—'}</td>
                      <td className="px-3 py-2">{line.description || '—'}</td>
                      <td className="px-3 py-2 text-right">{line.qty ?? '—'}</td>
                      <td className="px-3 py-2">{line.unit || '—'}</td>
                      <td className="px-3 py-2 text-right">
                        {typeof line.rate_cents === 'number' ? formatAmount(line.rate_cents) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {typeof line.amount_cents === 'number' ? formatAmount(line.amount_cents) : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {data.note ? (
            <div>
              <p className="text-xs uppercase text-gray-500 font-semibold">Note</p>
              <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{data.note}</p>
            </div>
          ) : null}

          {data.status === 'accepted' && (data.signerName || data.signedAt) ? (
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
              <p className="font-medium">Signed{data.signerName ? ` by ${data.signerName}` : ''}</p>
              {data.signedAt ? (
                <p className="text-xs mt-0.5">
                  {new Date(data.signedAt).toLocaleString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        {showApprove ? (
          <>
            <div className="p-6 border-t border-gray-200 bg-gray-50 space-y-3">
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
                <div className="text-sm flex-1">
                  <span className="text-gray-500 mr-2">Status:</span>
                  <span className={`font-semibold ${data.status === 'accepted' ? 'text-green-700' : 'text-gray-800'}`}>
                    {data.status}
                  </span>
                  {canApprove ? (
                    <label className="mt-3 block max-w-sm">
                      <span className="text-xs font-medium text-gray-600">Type your full name to sign</span>
                      <input
                        value={signerName}
                        onChange={(event) => setSignerName(event.target.value)}
                        className="mt-1 w-full rounded-lg border-2 border-black px-3 py-2 text-sm"
                        placeholder="Full legal name"
                        autoComplete="name"
                      />
                    </label>
                  ) : data.status !== 'accepted' ? (
                    <p className="mt-1 text-gray-600">This agreement has not been sent for approval.</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => onApprove?.({ signerName: signerName.trim() })}
                  disabled={
                    approveLoading ||
                    !canApprove ||
                    !onApprove ||
                    signerName.trim().length < 2
                  }
                  className="px-4 py-2 bg-black text-white rounded-lg font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {alreadyAccepted || data.status === 'accepted'
                    ? 'Signed & approved'
                    : approveLoading
                      ? 'Signing…'
                      : 'Sign & approve'}
                </button>
              </div>
              {approveMessage ? (
                <div
                  className={`text-sm ${
                    approveMessage.toLowerCase().includes('failed') ||
                    approveMessage.toLowerCase().includes('could not') ||
                    approveMessage.toLowerCase().includes('expired') ||
                    approveMessage.toLowerCase().includes('invalid')
                      ? 'text-red-600'
                      : 'text-green-700'
                  }`}
                >
                  {approveMessage}
                </div>
              ) : null}
            </div>
          </>
        ) : null}

        {variant === 'preview' ? (
          <div className="p-6 border-t border-gray-200 bg-gray-50 text-sm text-gray-600">
            <span className="text-gray-500 mr-2">Status on live link:</span>
            <span className="font-semibold text-gray-800">{data.status}</span>
            <span className="block mt-2 text-xs">
              Present on a phone or tablet, or send the secure link. The customer signs, then can pay the deposit.
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
