'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { TradeGrid } from '@/components/pros/TradeGrid';

interface TradeSelectionScreenProps {
  selected: string | null;
  onSelect: (slug: string) => void;
  onBack: () => void;
}

/** House Pro signup: pick the trade you identify with. It becomes the title on your card. */
export function TradeSelectionScreen({ selected, onSelect, onBack }: TradeSelectionScreenProps) {
  const t = useTranslations('houseTrades');
  const tNav = useTranslations('auth.signup.navigation');

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col text-black animate-fade-in md:pt-12">
      <h2 className="mb-2 text-center text-2xl font-semibold">{t('signupTitle')}</h2>
      <p className="mb-6 text-center text-sm text-gray-600">{t('signupDescription')}</p>
      <TradeGrid selected={selected ? [selected] : []} onSelect={onSelect} />
      <div className="mt-6 flex gap-4 pb-6">
        <Button type="button" variant="secondary" onClick={onBack} className="flex-1">
          {tNav('previous')}
        </Button>
      </div>
    </div>
  );
}
