'use client';

import { useMemo, useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { Check } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { TypingSearchInput } from '@/components/common/TypingSearchInput';
import {
  HOUSE_TRADE_GROUPS,
  houseTradeTitle,
  searchHouseTrades,
  type HouseTrade,
} from '@/lib/pros/house-trades';

const ICONS = LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>;

export function TradeIcon({ trade, className = 'h-5 w-5 text-red-500' }: { trade: HouseTrade; className?: string }) {
  const Icon = ICONS[trade.icon] ?? LucideIcons.Wrench;
  return <Icon className={className} />;
}

interface TradeGridProps {
  /** Highlighted trades. */
  selected: string[];
  onSelect: (slug: string) => void;
  /** Trades not offered here (e.g. the primary trade when picking extras). */
  hidden?: string[];
  disabled?: boolean;
}

/** Searchable list of every house trade, grouped from foundation to roof, then home services. */
export function TradeGrid({ selected, onSelect, hidden = [], disabled }: TradeGridProps) {
  const t = useTranslations('houseTrades');
  const locale = useLocale();
  const [search, setSearch] = useState('');

  const groups = useMemo(() => {
    const matches = searchHouseTrades(search).filter((trade) => !hidden.includes(trade.slug));
    return HOUSE_TRADE_GROUPS.map((group) => ({ group, trades: matches.filter((trade) => trade.group === group) })).filter(
      (entry) => entry.trades.length > 0
    );
  }, [search, hidden]);

  return (
    <div className="space-y-4">
      <TypingSearchInput value={search} onChange={setSearch} placeholder={t('searchPlaceholder')} clearLabel={t('clearSearch')} />
      {groups.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-500">{t('noMatch')}</p>
      ) : (
        groups.map(({ group, trades }) => (
          <section key={group}>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">{t(`group_${group}`)}</h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {trades.map((trade) => {
                const isOn = selected.includes(trade.slug);
                return (
                  <button
                    key={trade.slug}
                    type="button"
                    disabled={disabled}
                    onClick={() => onSelect(trade.slug)}
                    aria-pressed={isOn}
                    className={`flex items-center gap-3 rounded-lg border-2 p-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      isOn ? 'border-black bg-black text-white' : 'border-black bg-white text-black hover:bg-gray-50'
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 ${
                        isOn ? 'border-white bg-black' : 'border-black bg-white'
                      }`}
                    >
                      <TradeIcon trade={trade} className={`h-5 w-5 ${isOn ? 'text-white' : 'text-red-500'}`} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{houseTradeTitle(trade.slug, locale)}</span>
                      <span className={`block truncate text-xs ${isOn ? 'text-gray-300' : 'text-gray-500'}`}>
                        {trade.licensed ? t('needsLicense') : t('noLicense')}
                      </span>
                    </span>
                    {isOn && <Check className="h-4 w-4 shrink-0 text-white" />}
                  </button>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
