'use client';

import { Calendar, DollarSign } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';
import { EstimateSchema } from '@/lib/schemas/estimate';
import { FormField } from '@/components/ui/FormField';
import Accordion from '@/components/ui/Accordion';

interface BudgetTimelineAccordionProps {
  isOpen: boolean;
  onToggle: () => void;
  isComplete: boolean;
  methods: UseFormReturn<EstimateSchema>;
  errors: UseFormReturn<EstimateSchema>['formState']['errors'];
  isSubmitting: boolean;
  budgetRanges: Array<{ value: string; label: string }>;
  timelines: Array<{ value: string; label: string }>;
  tAccordion: (key: string) => string;
  tFields: (key: string) => string;
  tHelp: (key: string) => string;
  tTips: (key: string) => string;
}

export default function BudgetTimelineAccordion({
  isOpen,
  onToggle,
  isComplete,
  methods,
  errors,
  isSubmitting,
  budgetRanges,
  timelines,
  tAccordion,
  tFields,
  tHelp,
  tTips,
}: BudgetTimelineAccordionProps) {
  const { register } = methods;

  return (
    <Accordion
      title={tAccordion('budgetTimeline')}
      isOpen={isOpen}
      onToggle={onToggle}
      isComplete={isComplete}
      error={(errors.budgetRange || errors.timeline) ? tHelp('requiredFieldsHint') : undefined}
      required
      tip={tTips('budgetTimeline')}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          label={
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-red-600" />
              <span>{tFields('budgetRangeLabel')}</span>
            </div>
          }
          error={undefined}
        >
          <select
            {...register('budgetRange')}
            className={`w-full px-4 py-2.5 border-2 rounded-lg focus:outline-none transition-all cursor-pointer ${
              errors.budgetRange
                ? 'border-red-500 focus:border-red-500'
                : 'border-black'
            } bg-white disabled:cursor-not-allowed`}
            disabled={isSubmitting}
          >
            <option value="">{tFields('budgetRangePlaceholder')}</option>
            {budgetRanges.map((range) => (
              <option key={range.value} value={range.value}>{range.label}</option>
            ))}
          </select>
        </FormField>

        <FormField
          label={
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-red-600" />
              <span>{tFields('timelineLabel')}</span>
            </div>
          }
          error={undefined}
        >
          <select
            {...register('timeline')}
            className={`w-full px-4 py-2.5 border-2 rounded-lg focus:outline-none transition-all cursor-pointer ${
              errors.timeline
                ? 'border-red-500 focus:border-red-500'
                : 'border-black'
            } bg-white disabled:cursor-not-allowed`}
            disabled={isSubmitting}
          >
            <option value="">{tFields('timelinePlaceholder')}</option>
            {timelines.map((timeline) => (
              <option key={timeline.value} value={timeline.value}>{timeline.label}</option>
            ))}
          </select>
        </FormField>
      </div>
    </Accordion>
  );
}

