'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Briefcase, Check, ImageIcon, UserPlus, X } from 'lucide-react';
import ChatDocCard from '@/components/chat/ChatDocCard';
import { SimpleConfirmDialog } from '@/components/ui/SimpleConfirmDialog';
import { LEADS_CHANGED_EVENT } from '@/lib/leads/events';
import type { ChatLeadOffer } from '@/lib/types/chat';

/**
 * ProBot card for a job request the admin sent this pro. Before the pro accepts it shows only the
 * job; "Add to my CRM" creates the contact and reveals the customer. Read-only when someone else
 * (the admin) looks at the thread.
 */
export function LeadOfferCard({
  lead,
  canAnswer,
  onAnswered,
  onConfirmOpenChange,
}: {
  lead: ChatLeadOffer;
  canAnswer: boolean;
  onAnswered?: (lead: ChatLeadOffer) => void;
  /** Lets a surrounding modal ignore clicks on the confirm box (it renders outside the modal). */
  onConfirmOpenChange?: (open: boolean) => void;
}) {
  const t = useTranslations('probot');
  const locale = useLocale();
  const [state, setState] = useState<ChatLeadOffer>(lead);
  const [busy, setBusy] = useState<null | 'accept' | 'decline'>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDecline, setConfirmDecline] = useState(false);

  function setConfirm(open: boolean) {
    setConfirmDecline(open);
    onConfirmOpenChange?.(open);
  }

  async function answer(action: 'accept' | 'decline') {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/crm/leads/${state.referralId}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.status === 'cancelled' || data.status === 'declined' || data.status === 'expired') setState((current) => ({ ...current, status: data.status }));
        throw new Error(typeof data.error === 'string' ? data.error : t('leadFailed'));
      }
      const next: ChatLeadOffer = {
        ...state,
        status: data.status,
        ...(typeof data.customerId === 'string' ? { crmCustomerId: data.customerId } : {}),
        ...(typeof data.customerName === 'string' ? { customerName: data.customerName } : {}),
      };
      setState(next);
      onAnswered?.(next);
      window.dispatchEvent(new Event(LEADS_CHANGED_EVENT));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('leadFailed'));
    } finally {
      setBusy(null);
      if (action === 'decline') setConfirm(false);
    }
  }

  const facts = [
    state.budget ? { label: t('leadBudget'), value: state.budget } : null,
    state.timeline ? { label: t('leadTimeline'), value: state.timeline } : null,
  ].filter((fact): fact is { label: string; value: string } => fact !== null);

  return (
    <ChatDocCard
      tone="lead"
      icon={<Briefcase className="h-5 w-5" aria-hidden />}
      eyebrow={t('leadEyebrow')}
      title={state.status === 'accepted' && state.customerName ? state.customerName : state.projectType}
      subtitle={state.status === 'accepted' && state.customerName ? `${state.projectType} · ${state.area}` : state.area}
    >
      <div className="space-y-2.5 bg-gray-50 px-3 py-3 text-sm">
        {facts.length ? (
          <dl className="grid grid-cols-2 gap-2">
            {facts.map((fact) => (
              <div key={fact.label} className="rounded-lg border border-gray-200 bg-white px-2 py-1.5">
                <dt className="text-[11px] uppercase text-gray-500">{fact.label}</dt>
                <dd className="font-medium">{fact.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {state.description ? <p className="line-clamp-4 whitespace-pre-wrap text-gray-800">{state.description}</p> : null}
        {state.photoCount > 0 ? (
          <p className="flex items-center gap-1.5 text-xs text-gray-600">
            <ImageIcon className="h-3.5 w-3.5" aria-hidden />
            {t('leadPhotos', { count: state.photoCount })}
          </p>
        ) : null}

        {state.status === 'accepted' ? (
          <div className="space-y-2">
            <p className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
              <Check className="h-3.5 w-3.5" />
              {t('leadAccepted')}
            </p>
            {canAnswer && state.crmCustomerId ? (
              <Link
                href={`/${locale}/crm/customers?open=${state.crmCustomerId}`}
                className="inline-flex w-full items-center justify-center rounded-lg border-2 border-black bg-white px-4 py-2.5 text-sm font-semibold text-black hover:bg-gray-50"
              >
                {t('leadOpenContact')}
              </Link>
            ) : null}
          </div>
        ) : state.status === 'declined' ? (
          <p className="text-xs text-gray-600">{t('leadDeclined')}</p>
        ) : state.status === 'cancelled' ? (
          <p className="text-xs text-gray-600">{t('leadCancelled')}</p>
        ) : state.status === 'expired' ? (
          <p className="text-xs text-gray-600">{t('leadExpired')}</p>
        ) : canAnswer ? (
          <div className="space-y-1.5">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void answer('accept')}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-900 disabled:opacity-60"
            >
              <UserPlus className="h-4 w-4 text-red-500" />
              {busy === 'accept' ? t('leadAdding') : t('leadAdd')}
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => setConfirm(true)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border-2 border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:border-gray-500 disabled:opacity-60"
            >
              <X className="h-4 w-4" />
              {busy === 'decline' ? t('leadDeclining') : t('leadDecline')}
            </button>
            <p className="text-xs text-gray-500">{t('leadHint')}</p>
          </div>
        ) : (
          <p className="text-xs text-gray-500">{t('leadWaiting')}</p>
        )}
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
      </div>
      <SimpleConfirmDialog
        isOpen={confirmDecline}
        onClose={() => busy === null && setConfirm(false)}
        onConfirm={() => void answer('decline')}
        title={t('leadDeclineTitle')}
        message={t('leadDeclineConfirm')}
        confirmLabel={busy === 'decline' ? t('leadDeclining') : t('leadDeclineYes')}
        cancelLabel={t('leadKeep')}
        busy={busy === 'decline'}
      />
    </ChatDocCard>
  );
}
