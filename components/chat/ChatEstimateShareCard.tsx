'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { CheckCircle2, FileText, Loader2 } from 'lucide-react';
import type { ChatCrmEstimateShare } from '@/lib/types/chat';

interface ChatEstimateShareCardProps {
  estimate: ChatCrmEstimateShare;
  /** Customer can approve; pro/admin only watches status */
  canApprove: boolean;
  onApproved?: (next: ChatCrmEstimateShare) => void;
}

function money(cents: number) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);
}

export default function ChatEstimateShareCard({
  estimate,
  canApprove,
  onApproved,
}: ChatEstimateShareCardProps) {
  const t = useTranslations('probot');
  const [card, setCard] = useState(estimate);
  const [approving, setApproving] = useState(false);
  const [signerName, setSignerName] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCard(estimate);
  }, [estimate]);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      fetch(`/api/estimates/public?token=${encodeURIComponent(estimate.token)}`)
        .then((res) => res.json())
        .then((data) => {
          if (cancelled || data.error) return;
          setCard((prev) => ({
            ...prev,
            status: data.status ?? prev.status,
            amountCents: typeof data.amountCents === 'number' ? data.amountCents : prev.amountCents,
            depositCents: typeof data.depositCents === 'number' ? data.depositCents : prev.depositCents,
            validUntilDate: data.validUntilDate ?? prev.validUntilDate,
            estimateNumber: data.estimateNumber ? String(data.estimateNumber) : prev.estimateNumber,
            businessName: data.business?.business_name ?? prev.businessName,
            businessLogo: data.business?.business_logo ?? prev.businessLogo,
            lineItemsPreview: Array.isArray(data.lineItems)
              ? data.lineItems.slice(0, 4).map((line: Record<string, unknown>) => ({
                  product_or_service:
                    typeof line.product_or_service === 'string' ? line.product_or_service : null,
                  description: typeof line.description === 'string' ? line.description : null,
                  amount_cents: typeof line.amount_cents === 'number' ? line.amount_cents : null,
                }))
              : prev.lineItemsPreview,
          }));
        })
        .catch(() => {
          /* keep snapshot */
        });
    };
    refresh();
    // Pros watching the thread pick up approval without a full reload.
    const interval = !canApprove ? window.setInterval(refresh, 12_000) : undefined;
    return () => {
      cancelled = true;
      if (interval) window.clearInterval(interval);
    };
  }, [estimate.token, canApprove]);

  const accepted = card.status === 'accepted';
  const canClickApprove = canApprove && card.status === 'sent' && !approving;

  const handleApprove = async () => {
    if (!canClickApprove) return;
    const name = signerName.trim();
    if (name.length < 2) {
      setError(t('crmEstimateSignNameRequired'));
      return;
    }
    setApproving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/estimates/public/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: card.token, signerName: name, signatureData: name }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || t('crmEstimateApproveFailed'));

      const next: ChatCrmEstimateShare = {
        ...card,
        status: 'accepted',
        approvedAt: new Date().toISOString(),
        depositPaymentUrl: payload.depositPaymentUrl ?? card.depositPaymentUrl ?? null,
      };
      setCard(next);
      onApproved?.(next);

      if (payload.status === 'already_accepted') {
        setMessage(t('crmEstimateAlreadyApproved'));
      } else if (payload.depositError) {
        setMessage(t('crmEstimateApprovedDepositIssue', { detail: payload.depositError }));
      } else if (payload.depositPaymentUrl) {
        setMessage(t('crmEstimateApprovedWithDeposit'));
      } else {
        setMessage(t('crmEstimateApproved'));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('crmEstimateApproveFailed'));
    } finally {
      setApproving(false);
    }
  };

  return (
    <div className="mt-2 overflow-hidden rounded-2xl border-2 border-black bg-white text-gray-900 shadow-sm">
      <div className="flex items-start gap-3 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white px-3 py-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-white">
          {card.businessLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={card.businessLogo} alt="" className="h-full w-full object-cover" />
          ) : (
            <FileText className="h-5 w-5 text-gray-700" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            {t('crmEstimateCardTitle')}
          </p>
          <div className="flex min-w-0 items-center gap-2">
            {card.businessLogo ? (
              // eslint-disable-next-line @next/next/no-img-element -- chat card; remote business logos
              <img
                src={card.businessLogo}
                alt=""
                className="h-7 w-7 shrink-0 rounded-full border border-gray-200 object-cover"
              />
            ) : null}
            <p className="truncate text-sm font-semibold text-gray-900">
              {card.businessName || t('crmEstimateFromPro')}
            </p>
          </div>
          <p className="text-xs text-gray-500">
            #{card.estimateNumber}
            {card.validUntilDate
              ? ` · ${t('crmEstimateValidUntil', {
                  date: new Date(card.validUntilDate).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  }),
                })}`
              : null}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase text-gray-500">{t('crmEstimateTotal')}</p>
          <p className="text-base font-bold text-gray-900">{money(card.amountCents)}</p>
        </div>
      </div>

      {(card.depositCents ?? 0) > 0 ? (
        <div className="border-b border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          <span className="font-semibold">{t('crmEstimateDepositDue')}:</span>{' '}
          {money(card.depositCents)}
        </div>
      ) : null}

      {card.lineItemsPreview && card.lineItemsPreview.length > 0 ? (
        <ul className="divide-y divide-gray-100 px-3 py-1">
          {card.lineItemsPreview.map((line, index) => (
            <li key={index} className="flex items-start justify-between gap-3 py-2 text-xs">
              <span className="min-w-0 text-gray-700">
                <span className="block truncate font-medium text-gray-900">
                  {line.product_or_service || line.description || t('crmEstimateLineItem')}
                </span>
                {line.product_or_service && line.description ? (
                  <span className="block truncate text-gray-500">{line.description}</span>
                ) : null}
              </span>
              {typeof line.amount_cents === 'number' ? (
                <span className="shrink-0 font-medium text-gray-900">{money(line.amount_cents)}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-col gap-2 border-t border-gray-100 bg-gray-50 px-3 py-3">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-gray-500">{t('crmEstimateStatus')}</span>
          <span
            className={`inline-flex items-center gap-1 font-semibold ${
              accepted ? 'text-green-700' : 'text-gray-800'
            }`}
          >
            {accepted ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
            {accepted ? t('crmEstimateStatusAccepted') : t('crmEstimateStatusAwaiting')}
          </span>
        </div>

        {canClickApprove ? (
          <label className="block text-xs text-gray-600">
            {t('crmEstimateSignName')}
            <input
              value={signerName}
              onChange={(event) => setSignerName(event.target.value)}
              className="mt-1 w-full rounded-lg border-2 border-black px-3 py-2 text-sm text-gray-900"
              placeholder={t('crmEstimateSignNamePlaceholder')}
              autoComplete="name"
            />
          </label>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {canClickApprove ? (
            <button
              type="button"
              onClick={() => void handleApprove()}
              disabled={approving || signerName.trim().length < 2}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-900 disabled:cursor-wait disabled:opacity-60"
            >
              {approving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {approving ? t('crmEstimateApproving') : t('crmEstimateSignApprove')}
            </button>
          ) : accepted ? (
            <span className="inline-flex flex-1 items-center justify-center rounded-full border border-green-200 bg-green-50 px-4 py-2.5 text-sm font-semibold text-green-800">
              {t('crmEstimateApprovedBadge')}
            </span>
          ) : canApprove ? null : (
            <span className="inline-flex flex-1 items-center justify-center rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-600">
              {t('crmEstimateWaitingCustomer')}
            </span>
          )}

          <Link
            href={card.viewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-full border-2 border-black bg-white px-4 py-2.5 text-sm font-semibold text-black hover:bg-gray-50"
          >
            {t('crmEstimateViewFull')}
          </Link>
        </div>

        {accepted && card.depositPaymentUrl ? (
          <Link
            href={card.depositPaymentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-full bg-amber-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-amber-400"
          >
            {t('crmEstimatePayDeposit')}
          </Link>
        ) : null}

        {message ? <p className="text-xs font-medium text-green-700">{message}</p> : null}
        {error ? <p className="text-xs font-medium text-red-600">{error}</p> : null}
      </div>
    </div>
  );
}
