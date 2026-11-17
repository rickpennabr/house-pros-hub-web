'use client';

import { useTranslations } from 'next-intl';
import { Wrench } from 'lucide-react';

interface BusinessTradesTabProps {
  trades: string[];
  serviceArea?: string | null;
  roleLabel?: string;
}

export default function BusinessTradesTab({ trades, serviceArea, roleLabel }: BusinessTradesTabProps) {
  const t = useTranslations('businessTrades');

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-black">{t('heading')}</h2>
        {roleLabel ? <p className="mt-1 text-sm text-gray-600">{roleLabel}</p> : null}
        {serviceArea ? <p className="mt-1 text-sm text-gray-600">{t('serves', { area: serviceArea })}</p> : null}
      </div>

      {trades.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-6 text-center">
          <Wrench className="mx-auto h-8 w-8 text-gray-400" />
          <p className="mt-2 text-sm text-gray-700">{t('empty')}</p>
        </div>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {trades.map((trade) => (
            <li key={trade} className="rounded-full border-2 border-black bg-black px-3 py-1 text-sm font-medium text-white">
              {trade}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
