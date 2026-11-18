'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CheckCircle2, CreditCard, Receipt } from 'lucide-react';
import type { ChatCrmInvoiceShare } from '@/lib/types/chat';

interface ChatInvoiceShareCardProps {
  invoice: ChatCrmInvoiceShare;
  /** Customer pays from the card; the pro only watches the status. */
  canPay: boolean;
}

interface LiveInvoice {
  balanceCents: number;
  totalCents: number;
  dueDate: string | null;
  paid: boolean;
  cancelled: boolean;
  businessName: string | null;
  businessLogo: string | null;
}

function money(cents: number) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);
}

function formatDate(value: string | null | undefined, locale: string) {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ChatInvoiceShareCard({ invoice, canPay }: ChatInvoiceShareCardProps) {
  const t = useTranslations('probot');
  const locale = useLocale();
  const [live, setLive] = useState<LiveInvoice | null>(null);

  // Read the current balance and status with the public token; poll until it is paid.
  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      fetch(`/api/invoices/public?token=${encodeURIComponent(invoice.token)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (cancelled || !data || data.error) return;
          const totalCents = typeof data.amountCents === 'number' ? data.amountCents : invoice.amountCents;
          const appliedCents = typeof data.paymentAppliedCents === 'number' ? data.paymentAppliedCents : 0;
          const balanceCents = Math.max(0, totalCents - appliedCents);
          const next: LiveInvoice = {
            balanceCents,
            totalCents,
            dueDate: typeof data.dueDate === 'string' ? data.dueDate : invoice.dueDate ?? null,
            paid: data.status === 'paid' || balanceCents <= 0,
            cancelled: data.status === 'cancelled',
            businessName: data.business?.business_name ?? null,
            businessLogo: data.business?.business_logo ?? null,
          };
          setLive(next);
          if (next.paid || next.cancelled) window.clearInterval(timer);
        })
        .catch(() => {});
    };
    const timer = window.setInterval(refresh, 20000);
    refresh();
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [invoice.token, invoice.amountCents, invoice.dueDate]);

  const balanceCents = live?.balanceCents ?? invoice.amountCents;
  const paid = live?.paid ?? false;
  const cancelledInvoice = live?.cancelled ?? false;
  const due = formatDate(live?.dueDate ?? invoice.dueDate, locale);
  const viewHref = `/${locale}/invoices/view?token=${encodeURIComponent(invoice.token)}`;
  const isPayment = invoice.kind === 'payment';

  return (
    <div className="mt-2 min-w-[240px] overflow-hidden rounded-2xl border-2 border-black bg-white text-gray-900 shadow-sm">
      <div className="flex items-start gap-3 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white px-3 py-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-white">
          {live?.businessLogo ? (
            // eslint-disable-next-line @next/next/no-img-element -- chat card; remote business logos
            <img src={live.businessLogo} alt="" className="h-full w-full object-cover" />
          ) : isPayment ? (
            <CreditCard className="h-5 w-5 text-gray-700" />
          ) : (
            <Receipt className="h-5 w-5 text-gray-700" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            {isPayment ? t('crmPaymentCardTitle') : t('crmInvoiceCardTitle')} · #{invoice.invoiceNumber}
          </p>
          {live?.businessName ? <p className="truncate text-sm font-semibold">{live.businessName}</p> : null}
          {due && !paid ? <p className="text-xs text-gray-500">{t('crmInvoiceDue', { date: due })}</p> : null}
        </div>
      </div>
      <div className="px-3 py-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-xs text-gray-500">{paid ? t('crmEstimateTotal') : t('crmInvoiceBalanceDue')}</span>
          <span className="text-lg font-bold">{money(paid ? live?.totalCents ?? invoice.amountCents : balanceCents)}</span>
        </div>
        {paid ? (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {t('crmInvoicePaid')}
          </p>
        ) : cancelledInvoice ? (
          <p className="mt-2 text-xs font-medium text-gray-500">{t('crmInvoiceCancelled')}</p>
        ) : canPay ? (
          <a
            href={viewHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-black px-3 text-sm font-semibold text-white hover:bg-gray-800"
          >
            <CreditCard className="h-4 w-4" />
            {t('crmInvoicePay', { amount: money(balanceCents) })}
          </a>
        ) : (
          <p className="mt-2 text-xs font-medium text-amber-700">{t('crmInvoiceWaiting')}</p>
        )}
        <a
          href={viewHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 block text-center text-xs font-medium text-gray-600 underline hover:no-underline"
        >
          {t('crmInvoiceView')}
        </a>
      </div>
    </div>
  );
}
