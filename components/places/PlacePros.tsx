'use client';

import { useState } from 'react';
import Link from 'next/link';
import * as LucideIcons from 'lucide-react';
import { Mail, MessageCircle, Phone, Share2, Users } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Accordion from '@/components/ui/Accordion';
import ProAccordion from '@/components/ui/ProAccordion';
import { houseTrade, houseTradeTitle } from '@/lib/pros/house-trades';
import type { PlacePro } from '@/lib/places/portal';

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

const COUNT_KEYS = ['estimates', 'invoices', 'projects', 'maintenance', 'documents', 'appointments'] as const;

/** The trade line under the business name, with its icon, like the pro card header. */
function TradeLine({ slug }: { slug: string | null }) {
  const locale = useLocale();
  const trade = houseTrade(slug);
  if (!trade) return null;
  const Icon = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[trade.icon];
  return (
    <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs font-medium text-gray-600">
      {Icon ? <Icon className="h-3.5 w-3.5 shrink-0 text-red-500" /> : null}
      <span className="truncate">{houseTradeTitle(trade.slug, locale)}</span>
    </span>
  );
}

/** Logo + business name + trade: the collapsed header of one pro card. */
function ProCardTitle({ pro }: { pro: PlacePro }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-black bg-white text-base font-semibold">
        {pro.logoUrl ? (
          // Business logos live on the public storage host.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pro.logoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          pro.businessName.slice(0, 1).toUpperCase()
        )}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-semibold leading-tight">{pro.businessName}</span>
        <TradeLine slug={pro.primaryTrade} />
      </span>
    </span>
  );
}

/**
 * The pros working on one of the customer's places. Each card shows who the pro is, their trade,
 * how to reach them and what they did here; tapping "Only their work" filters every tab to them.
 * The section and each card collapse.
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
  const [open, setOpen] = useState(true);

  return (
    <Accordion
      title={`${t('title')} · ${pros.length}`}
      subtitle={pros.length > 0 ? t('intro') : t('empty')}
      icon={<Users className="h-5 w-5" />}
      isOpen={open}
      onToggle={() => setOpen((value) => !value)}
      className="mt-2"
    >
      {pros.length > 0 ? (
        <ul className="grid items-start gap-2 md:grid-cols-2">
          {pros.map((pro) => {
            const isSelected = selected === pro.ownerId;
            const counts = COUNT_KEYS.filter((key) => pro.counts[key] > 0).map((key) =>
              t(`counts.${key}`, { count: pro.counts[key] })
            );
            return (
              <li
                key={pro.ownerId}
                className={`rounded-lg border-2 p-3 text-sm ${isSelected ? 'border-red-600' : 'border-black'}`}
              >
                <ProAccordion
                  title={<ProCardTitle pro={pro} />}
                  defaultOpen={pros.length === 1 || isSelected}
                  contentClassName="space-y-2"
                >
                  {pro.trades.length > 0 ? (
                    <p className="flex flex-wrap gap-1">
                      {pro.trades.map((trade) => (
                        <span key={trade} className="rounded-md border border-black px-2 py-0.5 text-xs">
                          {trade}
                        </span>
                      ))}
                    </p>
                  ) : null}

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
                </ProAccordion>
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
    </Accordion>
  );
}
