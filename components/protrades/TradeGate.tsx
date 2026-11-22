'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { HardscapeIcon, LandscapeIcon } from '@/components/icons/hub';
import { useProTrades } from '@/hooks/useProTrades';
import { TRADES, type TradeSlug } from '@/lib/protrades/trades';

/** Shows a trade's tool only while that trade is on; otherwise a "turn it on" screen. */
export function TradeGate({ trade, children }: { trade: TradeSlug; children: ReactNode }) {
  const t = useTranslations('protrades');
  const locale = useLocale();
  const { state, loaded } = useProTrades();

  if (!loaded) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }
  if (state?.active.includes(trade)) return <>{children}</>;
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      {trade === 'landscape' ? (
        <LandscapeIcon className={`mx-auto h-12 w-12 ${TRADES[trade].color.text}`} />
      ) : (
        <HardscapeIcon className={`mx-auto h-12 w-12 ${TRADES[trade].color.text}`} />
      )}
      <h1 className="mt-3 text-xl font-semibold">
        {TRADES[trade].available ? t('gateTitle', { trade: t(`trade_${trade}`) }) : `${t(`trade_${trade}`)}: ${t('comingSoon')}`}
      </h1>
      {TRADES[trade].available ? <p className="mt-2 text-sm text-gray-600">{t('gateBody', { trade: t(`trade_${trade}`) })}</p> : null}
      <Link
        href={`/${locale}/crm/protrades`}
        className="mt-5 inline-flex items-center justify-center rounded-lg bg-black px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-900"
      >
        {t('openProTrades')}
      </Link>
    </div>
  );
}
