'use client';

import { UseFormReturn } from 'react-hook-form';
import { EstimateSchema } from '@/lib/schemas/estimate';
import { FormField } from '@/components/ui/FormField';
import Accordion from '@/components/ui/Accordion';

interface ProjectDescriptionAccordionProps {
  isOpen: boolean;
  onToggle: () => void;
  isComplete: boolean;
  methods: UseFormReturn<EstimateSchema>;
  errors: UseFormReturn<EstimateSchema>['formState']['errors'];
  isSubmitting: boolean;
  tAccordion: (key: string) => string;
  tFields: (key: string) => string;
  tHelp: (key: string) => string;
}

export default function ProjectDescriptionAccordion({
  isOpen,
  onToggle,
  isComplete,
  methods,
  errors,
  isSubmitting,
  tAccordion,
  tFields,
  tHelp,
}: ProjectDescriptionAccordionProps) {
  const { register } = methods;

  return (
    <Accordion
      title={tAccordion('description')}
      isOpen={isOpen}
      onToggle={onToggle}
      isComplete={isComplete}
      error={errors.projectDescription ? tHelp('requiredFieldsHint') : undefined}
      required
    >
      <FormField label="" error={undefined}>
        <textarea
          {...register('projectDescription')}
          rows={5}
          placeholder={tFields('projectDescriptionPlaceholder')}
          className={`w-full px-3 py-2.5 border-2 rounded-lg focus:outline-none transition-all resize-none ${
            errors.projectDescription
              ? 'border-red-500 focus:border-red-500'
              : 'border-black'
          } bg-white`}
          disabled={isSubmitting}
        />
      </FormField>
    </Accordion>
  );
}

