'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useFormContext } from 'react-hook-form';
import Modal from '@/components/ui/Modal';
import { TradeGrid, TradeIcon } from '@/components/pros/TradeGrid';
import { houseTrade, houseTradeTitle } from '@/lib/pros/house-trades';
import type { BusinessFormValues } from '@/lib/schemas/business';

const MAX_EXTRA = 7;

/**
 * Business form field: the trade the pro identifies with (title on their card) and the other trades they do.
 * Reads and writes `primaryTrade` and `trades` on the surrounding react-hook-form.
 */
export function TradePickerField({ disabled }: { disabled?: boolean }) {
  const t = useTranslations('houseTrades');
  const locale = useLocale();
  const { watch, setValue } = useFormContext<BusinessFormValues>();
  const primary = houseTrade(watch('primaryTrade'));
  const extras = (watch('trades') ?? []).filter((slug) => slug !== primary?.slug);
  const [picking, setPicking] = useState<'primary' | 'extra' | null>(null);

  const choose = (slug: string) => {
    if (picking === 'primary') {
      setValue('primaryTrade', slug, { shouldDirty: true });
      setValue(
        'trades',
        extras.filter((item) => item !== slug),
        { shouldDirty: true }
      );
      setPicking(null);
      return;
    }
    const next = extras.includes(slug) ? extras.filter((item) => item !== slug) : [...extras, slug].slice(0, MAX_EXTRA);
    setValue('trades', next, { shouldDirty: true });
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {t('primaryLabel')} <span className="text-red-500">*</span>
        </label>
        <p className="mb-2 text-xs text-gray-500">{t('primaryHelp')}</p>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setPicking('primary')}
          className="flex w-full items-center gap-3 rounded-lg border-2 border-black bg-white p-2 text-left hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 border-black">
            {primary ? <TradeIcon trade={primary} /> : <Plus className="h-5 w-5 text-red-500" />}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-black">
            {primary ? houseTradeTitle(primary.slug, locale) : t('pickTrade')}
          </span>
          <span className="shrink-0 text-xs font-medium text-gray-500">{primary ? t('change') : ''}</span>
        </button>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">{t('extraLabel')}</label>
        <div className="flex flex-wrap gap-2">
          {extras.map((slug) => {
            const trade = houseTrade(slug);
            if (!trade) return null;
            return (
              <span key={slug} className="inline-flex items-center gap-1.5 rounded-md border-2 border-black bg-white px-2 py-1 text-xs font-medium text-black">
                <TradeIcon trade={trade} className="h-3.5 w-3.5 text-red-500" />
                {houseTradeTitle(slug, locale)}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => setValue('trades', extras.filter((item) => item !== slug), { shouldDirty: true })}
                  aria-label={t('remove')}
                  className="rounded-md p-0.5 hover:bg-gray-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
          {extras.length < MAX_EXTRA && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => setPicking('extra')}
              className="inline-flex items-center gap-1 rounded-md border-2 border-dashed border-gray-400 px-2 py-1 text-xs font-medium text-gray-600 hover:border-black hover:text-black disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" /> {t('addExtra')}
            </button>
          )}
        </div>
      </div>

      <Modal
        isOpen={picking !== null}
        onClose={() => setPicking(null)}
        title={picking === 'primary' ? t('primaryLabel') : t('extraLabel')}
        maxWidth="2xl"
      >
        <div className="max-h-[70vh] overflow-y-auto p-1">
          <TradeGrid
            selected={picking === 'primary' ? (primary ? [primary.slug] : []) : extras}
            hidden={picking === 'extra' && primary ? [primary.slug] : []}
            onSelect={choose}
          />
        </div>
        {picking === 'extra' && (
          <div className="flex justify-end pt-3">
            <button
              type="button"
              onClick={() => setPicking(null)}
              className="rounded-lg border-2 border-black bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              {t('done')}
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
