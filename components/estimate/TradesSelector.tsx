'use client';

import { UseFormReturn } from 'react-hook-form';
import { EstimateSchema } from '@/lib/schemas/estimate';
import { SERVICE_CATEGORIES } from '@/lib/constants/categories';
import { FormField } from '@/components/ui/FormField';
import Accordion from '@/components/ui/Accordion';

interface TradesSelectorProps {
  isOpen: boolean;
  onToggle: () => void;
  isComplete: boolean;
  methods: UseFormReturn<EstimateSchema>;
  errors: UseFormReturn<EstimateSchema>['formState']['errors'];
  selectedTrades: string[];
  onToggleTrade: (tradeLabel: string) => void;
  tAccordion: (key: string) => string;
  tCategories: (key: string) => string;
  tHelp: (key: string) => string;
  tTips: (key: string) => string;
}

export default function TradesSelector({
  isOpen,
  onToggle,
  isComplete,
  errors,
  selectedTrades,
  onToggleTrade,
  tAccordion,
  tCategories,
  tHelp,
  tTips,
}: TradesSelectorProps) {
  return (
    <Accordion
      title={tAccordion('trades')}
      isOpen={isOpen}
      onToggle={onToggle}
      isComplete={isComplete}
      error={errors.trades ? tHelp('tradesRequiredHint') : undefined}
      required
      tip={tTips('trades')}
    >
      <FormField label="" error={undefined}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {SERVICE_CATEGORIES.map((category) => {
            const Icon = category.icon;
            const isSelected = selectedTrades.includes(category.label);
            const translationKey = category.label.toLowerCase();
            const translatedLabel = category.label === 'All' ? tCategories('all') : tCategories(translationKey);
            return (
              <button
                key={category.label}
                type="button"
                onClick={() => onToggleTrade(category.label)}
                className={`
                  flex flex-col items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all cursor-pointer
                  ${isSelected
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-black border-black hover:bg-gray-50'
                  }
                  hover:scale-105 active:scale-95
                `}
              >
                <Icon className={`w-5 h-5 ${isSelected ? 'text-white' : category.color}`} />
                <span className="text-xs font-medium text-center">{translatedLabel}</span>
              </button>
            );
          })}
        </div>
        {selectedTrades.length > 0 && (
          <p className="text-sm text-gray-600 mt-2">
            {tAccordion('selectedPrefix')} {selectedTrades.map((trade) => {
              const translationKey = trade.toLowerCase();
              return trade === 'All' ? tCategories('all') : tCategories(translationKey);
            }).join(', ')}
          </p>
        )}
      </FormField>
    </Accordion>
  );
}

