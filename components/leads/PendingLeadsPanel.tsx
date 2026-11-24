'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Briefcase, Clock } from 'lucide-react';
import { LeadOfferModal } from '@/components/leads/LeadOfferModal';
import { useOpenLeads } from '@/components/leads/useOpenLeads';
import type { ChatLeadOffer } from '@/lib/types/chat';

/**
 * Top of Contacts: customers House Pros Hub sent this pro that wait for approval. Only the job shows
 * until the pro adds it; Review opens the same card as the bell and ProBot.
 */
export function PendingLeadsPanel({ onAccepted }: { onAccepted?: () => void }) {
  const t = useTranslations('probot');
  const { leads } = useOpenLeads();
  const [open, setOpen] = useState<ChatLeadOffer | null>(null);
  // Time left is rough (whole hours), so the page-load time is close enough.
  const [now] = useState(() => Date.now());

  const modal = (
    <LeadOfferModal
      lead={open}
      onClose={() => setOpen(null)}
      onAnswered={(answered) => {
        setOpen(answered);
        if (answered.status === 'accepted') onAccepted?.();
      }}
    />
  );
  if (!leads.length) return modal;

  return (
    <section className="mb-3 overflow-hidden rounded-lg border-2 border-red-600 bg-white">
      <header className="flex items-center gap-2 border-b-2 border-red-600 bg-red-50 px-4 py-2.5">
        <h2 className="font-semibold text-black">{t('leadPendingTitle')}</h2>
        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold text-white">
          {leads.length}
        </span>
        <p className="ml-2 hidden min-w-0 truncate text-xs text-gray-600 md:block">{t('leadPendingHint')}</p>
      </header>
      <ul className="divide-y divide-gray-200">
        {leads.map((lead) => {
          const hours = Math.floor((new Date(lead.expiresAt).getTime() - now) / 3_600_000);
          return (
            <li key={lead.referralId} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-red-600 bg-red-50 text-red-600">
                <Briefcase className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-semibold text-black">
                  {t('leadNewCustomer')}
                  <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{t('leadPendingChip')}</span>
                </p>
                <p className="truncate text-sm text-gray-700">{[lead.projectType, lead.area, lead.budget].filter(Boolean).join(' · ')}</p>
                <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-gray-500">
                  <Clock className="h-3.5 w-3.5" aria-hidden />
                  {hours >= 1 ? t('leadHoursLeft', { hours }) : t('leadUnderHour')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(lead)}
                className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 max-md:w-full"
              >
                {t('leadReview')}
              </button>
            </li>
          );
        })}
      </ul>
      {modal}
    </section>
  );
}
