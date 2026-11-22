'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Check, Loader2 } from 'lucide-react';
import { HardscapeIcon, LandscapeIcon } from '@/components/icons/hub';
import { useProTrades } from '@/hooks/useProTrades';
import { TRADES, TRADE_SLUGS, type TradeSlug } from '@/lib/protrades/trades';

const ICONS = { Leaf: LandscapeIcon, BrickWall: HardscapeIcon } as const;

export default function ProTradesPage() {
  const t = useTranslations('protrades');
  const locale = useLocale();
  const { state, loaded, setActive } = useProTrades();
  const [busy, setBusy] = useState<TradeSlug | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = async (trade: TradeSlug, active: boolean) => {
    setBusy(trade);
    setError(null);
    try {
      await setActive(trade, active);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('toggleFailed'));
    } finally {
      setBusy(null);
    }
  };

  const used = state?.active.length ?? 0;
  const limit = state?.limit ?? null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 md:text-2xl">ProTrades</h1>
        <p className="text-sm text-gray-600">{t('intro')}</p>
      </div>

      {loaded && limit !== null ? (
        <p className="rounded-lg border-2 border-black p-3 text-sm">
          {t('limitNote', { plan: state?.planName ?? '', used, limit })}{' '}
          <Link href={`/${locale}/subscription`} className="font-semibold underline">
            {t('seePlans')}
          </Link>
        </p>
      ) : null}
      {loaded && state && !state.canManage ? <p className="rounded-lg border-2 border-black p-3 text-sm">{t('crewNote')}</p> : null}
      {error ? <p className="rounded-lg border-2 border-red-600 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      {!loaded ? (
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {TRADE_SLUGS.map((slug) => {
            const trade = TRADES[slug];
            const Icon = ICONS[trade.icon];
            const on = state?.active.includes(slug) ?? false;
            return (
              <div key={slug} className={`group flex flex-col rounded-lg border-2 p-5 ${trade.color.border} bg-white ${trade.available ? '' : 'opacity-75'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-11 w-11 items-center justify-center rounded-lg border-2 ${trade.color.border} bg-white`}>
                      <Icon className={`h-6 w-6 ${trade.color.text}`} />
                    </span>
                    <div>
                      <p className="text-lg font-bold">{t(`trade_${slug}`)}</p>
                      {!trade.available ? (
                        <p className={`text-xs font-semibold ${trade.color.text}`}>{t('comingSoon')}</p>
                      ) : on ? (
                        <p className={`flex items-center gap-1 text-xs font-semibold ${trade.color.text}`}>
                          <Check className="h-3.5 w-3.5" />
                          {t('on')}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-500">{t('off')}</p>
                      )}
                    </div>
                  </div>
                  {trade.available ? (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    aria-label={t(`trade_${slug}`)}
                    disabled={busy !== null || !state?.canManage}
                    onClick={() => void toggle(slug, !on)}
                    className={`flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 p-0.5 transition-colors disabled:cursor-wait disabled:opacity-60 ${on ? `justify-end ${trade.color.solid} ${trade.color.border}` : 'justify-start border-gray-300 bg-gray-200'}`}
                  >
                    <span className="block h-5 w-5 shrink-0 rounded-full bg-white shadow" />
                  </button>
                  ) : null}
                </div>
                <p className="mt-3 text-sm text-gray-700">{t(`desc_${slug}`)}</p>
                <ul className="mt-3 space-y-1 text-sm">
                  {trade.tools.map((tool) => (
                    <li key={tool.path} className="flex items-center gap-2">
                      <Check className={`h-4 w-4 shrink-0 ${trade.color.text}`} />
                      {on ? (
                        <Link href={`/${locale}/crm${tool.path}`} className="underline">
                          {t(tool.labelKey)}
                        </Link>
                      ) : (
                        t(tool.labelKey)
                      )}
                    </li>
                  ))}
                </ul>
                {busy === slug ? <Loader2 className="mt-3 h-4 w-4 animate-spin" /> : null}
              </div>
            );
          })}
        </div>
      )}
      <p className="text-xs text-gray-500">{t('offKeepsData')}</p>
    </div>
  );
}
