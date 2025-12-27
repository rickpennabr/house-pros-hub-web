'use client';

import { UseFormReturn } from 'react-hook-form';
import { EstimateSchema } from '@/lib/schemas/estimate';
import { FormField } from '@/components/ui/FormField';
import Accordion from '@/components/ui/Accordion';

interface NotesAccordionProps {
  isOpen: boolean;
  onToggle: () => void;
  methods: UseFormReturn<EstimateSchema>;
  errors: UseFormReturn<EstimateSchema>['formState']['errors'];
  isSubmitting: boolean;
  tAccordion: (key: string) => string;
  tFields: (key: string) => string;
}

export default function NotesAccordion({
  isOpen,
  onToggle,
  methods,
  errors,
  isSubmitting,
  tAccordion,
  tFields,
}: NotesAccordionProps) {
  const { register } = methods;

  return (
    <Accordion
      title={tAccordion('additionalNotes')}
      isOpen={isOpen}
      onToggle={onToggle}
      isComplete={false}
    >
      <FormField label="" error={undefined}>
        <textarea
          {...register('additionalNotes')}
          rows={3}
          placeholder={tFields('additionalNotesPlaceholder')}
          className={`w-full px-3 py-2.5 border-2 rounded-lg focus:outline-none transition-all resize-none ${
            errors.additionalNotes
              ? 'border-red-500 focus:border-red-500'
              : 'border-black'
          } bg-white`}
          disabled={isSubmitting}
        />
      </FormField>
    </Accordion>
  );
}

