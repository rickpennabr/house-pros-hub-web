'use client';

import Link from 'next/link';
import { Mail, MessageCircle, Phone, Share2, Users } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { PlacePro } from '@/lib/places/portal';

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

const COUNT_KEYS = ['estimates', 'invoices', 'projects', 'maintenance', 'documents', 'appointments'] as const;

/**
 * The pros working on one of the customer's places. Each card shows who the pro is, their trade,
 * how to reach them and what they did here; tapping "Only their work" filters every tab to them.
 */
export function PlacePros({
  pros,
  selected,
  onSelect,
  onShare,
}: {
  pros: PlacePro[];
  selected: string | null;
  onSelect: (ownerId: string | null) => void;
  onShare: () => void;
}) {
  const t = useTranslations('places.prosSection');
  const locale = useLocale();

  return (
    <section className="mt-2 space-y-3 rounded-lg border-2 border-black p-3 md:p-4" aria-label={t('title')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 font-semibold">
            <Users className="h-5 w-5 shrink-0 text-red-500" />
            {t('title')}
            <span className="font-normal text-gray-500">· {pros.length}</span>
          </h3>
          <p className="text-xs text-gray-600">{pros.length > 0 ? t('intro') : t('empty')}</p>
        </div>
      </div>

      {pros.length > 0 ? (
        <ul className="grid gap-2 md:grid-cols-2">
          {pros.map((pro) => {
            const isSelected = selected === pro.ownerId;
            const counts = COUNT_KEYS.filter((key) => pro.counts[key] > 0).map((key) =>
              t(`counts.${key}`, { count: pro.counts[key] })
            );
            return (
              <li
                key={pro.ownerId}
                className={`space-y-2 rounded-lg border-2 p-3 text-sm ${isSelected ? 'border-red-600' : 'border-black'}`}
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-black bg-white font-semibold">
                    {pro.logoUrl ? (
                      // Business logos live on the public storage host.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={pro.logoUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      pro.businessName.slice(0, 1).toUpperCase()
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-tight">{pro.businessName}</p>
                    {pro.trades.length > 0 ? (
                      <p className="mt-1 flex flex-wrap gap-1">
                        {pro.trades.map((trade) => (
                          <span key={trade} className="rounded-full border border-black px-2 py-0.5 text-xs">
                            {trade}
                          </span>
                        ))}
                      </p>
                    ) : null}
                  </div>
                </div>

                <p className="text-xs text-gray-700">{counts.length > 0 ? counts.join(' · ') : t('noWork')}</p>
                {pro.openBalanceCents > 0 ? (
                  <p className="text-xs font-semibold text-red-600">{t('openBalance', { amount: money(pro.openBalanceCents) })}</p>
                ) : null}

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                  {pro.phone ? (
                    <a href={`tel:${pro.phone}`} className="inline-flex items-center gap-1 font-medium hover:underline">
                      <Phone className="h-4 w-4 text-red-500" />
                      {pro.phone}
                    </a>
                  ) : null}
                  {pro.email ? (
                    <a href={`mailto:${pro.email}`} className="inline-flex min-w-0 items-center gap-1 font-medium hover:underline">
                      <Mail className="h-4 w-4 shrink-0 text-red-500" />
                      <span className="truncate">{pro.email}</span>
                    </a>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => onSelect(isSelected ? null : pro.ownerId)}
                    className={`rounded-lg border-2 border-black px-3 py-1.5 text-xs font-medium ${
                      isSelected ? 'bg-black text-white' : 'bg-white hover:bg-gray-50'
                    }`}
                  >
                    {isSelected ? t('showAll') : t('showWork')}
                  </button>
                  {pro.slug ? (
                    <Link
                      href={`/${locale}/probot?contact=${encodeURIComponent(pro.slug)}`}
                      className="inline-flex items-center gap-1 rounded-lg border-2 border-black px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
                    >
                      <MessageCircle className="h-4 w-4 text-red-500" />
                      {t('message')}
                    </Link>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onShare}
          className="inline-flex items-center gap-2 rounded-lg bg-black px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          <Share2 className="h-4 w-4 text-red-500" />
          {t('share')}
        </button>
      </div>
    </section>
  );
}
