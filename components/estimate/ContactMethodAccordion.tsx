'use client';

import { UseFormReturn } from 'react-hook-form';
import { EstimateSchema } from '@/lib/schemas/estimate';
import { FormField } from '@/components/ui/FormField';
import Accordion from '@/components/ui/Accordion';

interface ContactMethodAccordionProps {
  isOpen: boolean;
  onToggle: () => void;
  isComplete: boolean;
  methods: UseFormReturn<EstimateSchema>;
  errors: UseFormReturn<EstimateSchema>['formState']['errors'];
  isSubmitting: boolean;
  contactMethods: Array<{ value: string; label: string }>;
  selectedContactMethod?: EstimateSchema['preferredContactMethod'];
  onSelectContactMethod: (value: string) => void;
  tAccordion: (key: string) => string;
  tHelp: (key: string) => string;
}

export default function ContactMethodAccordion({
  isOpen,
  onToggle,
  isComplete,
  errors,
  isSubmitting,
  contactMethods,
  selectedContactMethod,
  onSelectContactMethod,
  tAccordion,
  tHelp,
}: ContactMethodAccordionProps) {
  return (
    <Accordion
      title={tAccordion('preferredContact')}
      isOpen={isOpen}
      onToggle={onToggle}
      isComplete={isComplete}
      error={errors.preferredContactMethod ? tHelp('requiredFieldsHint') : undefined}
      required
    >
      <FormField label="" error={undefined}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {contactMethods.map((method) => {
            const isSelected = selectedContactMethod === method.value;
            return (
              <button
                key={method.value}
                type="button"
                onClick={() => onSelectContactMethod(method.value)}
                disabled={isSubmitting}
                className={`
                  flex flex-col items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all cursor-pointer
                  ${isSelected
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-black border-black hover:bg-gray-50'
                  }
                  ${errors.preferredContactMethod ? 'border-red-500' : ''}
                  hover:scale-105 active:scale-95
                  disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
                `}
              >
                <span className="text-sm font-medium text-center">{method.label}</span>
              </button>
            );
          })}
        </div>
      </FormField>
    </Accordion>
  );
}

