'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CheckCircle2, CreditCard, Loader2, Receipt } from 'lucide-react';
import type { ChatCrmInvoiceShare, ChatDocPlace } from '@/lib/types/chat';
import ChatDocCard, { ChatDocPlaceNote } from '@/components/chat/ChatDocCard';
import ChatDocViewer from '@/components/chat/ChatDocViewer';
import { startInvoiceCheckout } from '@/components/invoices/PublicInvoiceView';

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
  /** The customer's house it is on now. */
  place: ChatDocPlace | null;
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
  const [viewing, setViewing] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  /** The invoice was deleted (or its link expired): the card says so and stops asking. */
  const [gone, setGone] = useState(false);

  // Read the current balance and status with the public token; poll until it is paid.
  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      fetch(`/api/invoices/public?token=${encodeURIComponent(invoice.token)}`)
        .then((res) => {
          if (res.status === 404) {
            window.clearInterval(timer);
            if (!cancelled) setGone(true);
            return null;
          }
          return res.ok ? res.json() : null;
        })
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
            place: 'place' in data ? data.place ?? null : null,
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
  const isPayment = invoice.kind === 'payment';
  const typeLabel = isPayment ? t('crmPaymentCardTitle') : t('crmInvoiceCardTitle');

  const pay = async () => {
    setPaying(true);
    setPayError(null);
    try {
      // Card checkout returns to this chat; the card then shows Paid.
      await startInvoiceCheckout(invoice.token, `${window.location.pathname}${window.location.search}`);
    } catch (err) {
      setPayError(err instanceof Error ? err.message : t('crmComposerFailed'));
      setPaying(false);
    }
  };

  return (
    <ChatDocCard
      tone={isPayment ? 'payment' : 'invoice'}
      icon={isPayment ? <CreditCard className="h-5 w-5" /> : <Receipt className="h-5 w-5" />}
      logoUrl={live?.businessLogo}
      eyebrow={`${typeLabel} · #${invoice.invoiceNumber}`}
      title={live?.businessName || t('crmEstimateFromPro')}
      subtitle={due && !paid ? t('crmInvoiceDue', { date: due }) : null}
      amountLabel={paid ? t('crmEstimateTotal') : t('crmInvoiceBalanceDue')}
      amount={money(paid ? live?.totalCents ?? invoice.amountCents : balanceCents)}
    >
      <div className="flex flex-col gap-2 bg-gray-50 px-3 py-3">
        {gone ? (
          <p className="py-1 text-center text-xs font-medium text-gray-500">{t('crmInvoiceUnavailable')}</p>
        ) : (
          <>
            {paid ? (
              <p className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-sm font-semibold text-green-800">
                <CheckCircle2 className="h-4 w-4" />
                {t('crmInvoicePaid')}
              </p>
            ) : cancelledInvoice ? (
              <p className="text-center text-xs font-medium text-gray-500">{t('crmInvoiceCancelled')}</p>
            ) : null}
            <div className="flex gap-2">
              {!paid && !cancelledInvoice ? (
                canPay ? (
                  <button
                    type="button"
                    onClick={() => void pay()}
                    disabled={paying}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-900 disabled:cursor-wait disabled:opacity-60"
                  >
                    {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                    {t('crmInvoicePay', { amount: money(balanceCents) })}
                  </button>
                ) : (
                  <span className="inline-flex flex-1 items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-amber-700">
                    {t('crmInvoiceWaiting')}
                  </span>
                )
              ) : (
                <span className="flex-1" />
              )}
              <button
                type="button"
                onClick={() => setViewing(true)}
                className="inline-flex shrink-0 items-center justify-center rounded-lg border-2 border-black bg-white px-4 py-2.5 text-sm font-semibold text-black hover:bg-gray-50"
              >
                {t('crmEstimateViewFull')}
              </button>
            </div>
            {payError ? <p className="text-xs font-medium text-red-600">{payError}</p> : null}
            <ChatDocPlaceNote place={live ? live.place : invoice.place ?? null} canOpen={canPay} />
          </>
        )}
      </div>
      {viewing ? (
        <ChatDocViewer
          kind="invoice"
          token={invoice.token}
          title={`${typeLabel} #${invoice.invoiceNumber}`}
          canAct={canPay}
          onClose={() => setViewing(false)}
        />
      ) : null}
    </ChatDocCard>
  );
}
