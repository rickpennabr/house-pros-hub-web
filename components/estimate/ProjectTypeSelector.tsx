'use client';

import { UseFormReturn } from 'react-hook-form';
import { EstimateSchema } from '@/lib/schemas/estimate';
import { FormField } from '@/components/ui/FormField';
import Accordion from '@/components/ui/Accordion';

interface ProjectTypeSelectorProps {
  isOpen: boolean;
  onToggle: () => void;
  isComplete: boolean;
  methods: UseFormReturn<EstimateSchema>;
  errors: UseFormReturn<EstimateSchema>['formState']['errors'];
  isSubmitting: boolean;
  projectTypes: Array<{ value: string; label: string }>;
  selectedProjectType?: EstimateSchema['projectType'];
  onSelectProjectType: (value: string) => void;
  tAccordion: (key: string) => string;
  tFields: (key: string) => string;
  tValidation: (key: string) => string;
  tHelp: (key: string) => string;
}

export default function ProjectTypeSelector({
  isOpen,
  onToggle,
  isComplete,
  methods,
  errors,
  isSubmitting,
  projectTypes,
  selectedProjectType,
  onSelectProjectType,
  tAccordion,
  tFields,
  tValidation,
  tHelp,
}: ProjectTypeSelectorProps) {
  const { register } = methods;

  return (
    <Accordion
      title={tAccordion('projectType')}
      isOpen={isOpen}
      onToggle={onToggle}
      isComplete={isComplete}
      error={errors.projectType ? tHelp('requiredFieldsHint') : undefined}
      required
    >
      <FormField label="" error={undefined}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {projectTypes.map((type) => {
            const isSelected = selectedProjectType === type.value;
            return (
              <button
                key={type.value}
                type="button"
                onClick={() => onSelectProjectType(type.value)}
                disabled={isSubmitting}
                className={`
                  flex flex-col items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all cursor-pointer
                  ${isSelected
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-black border-black hover:bg-gray-50'
                  }
                  ${errors.projectType ? 'border-red-500' : ''}
                  hover:scale-105 active:scale-95
                  disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
                `}
              >
                <span className="text-sm font-medium text-center">{type.label}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-4 space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              {...register('requiresHoaApproval')}
              type="checkbox"
              disabled={isSubmitting}
              className="w-4 h-4 border-2 border-black rounded focus:ring-0 focus:ring-offset-0 checked:bg-black checked:border-black cursor-pointer accent-black"
            />
            <span className="text-sm font-medium text-black">{tFields('requiresHoaApprovalLabel')}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              {...register('wants3D')}
              type="checkbox"
              disabled={isSubmitting}
              className="w-4 h-4 border-2 border-black rounded focus:ring-0 focus:ring-offset-0 checked:bg-black checked:border-black cursor-pointer accent-black"
            />
            <span className="text-sm font-medium text-black">{tFields('wants3DLabel')}</span>
          </label>
        </div>
      </FormField>
      {selectedProjectType === 'other' && (
        <div className="mt-4">
          <FormField
            label={tFields('projectTypeOtherLabel')}
            error={errors.projectTypeOther?.message ? tValidation(errors.projectTypeOther.message as string) : undefined}
          >
            <input
              {...register('projectTypeOther')}
              type="text"
              placeholder={tFields('projectTypeOtherPlaceholder')}
              disabled={isSubmitting}
              className={`w-full px-4 py-2.5 border-2 rounded-lg focus:outline-none transition-all ${
                errors.projectTypeOther
                  ? 'border-red-500 focus:border-red-500'
                  : 'border-black'
              } bg-white`}
            />
          </FormField>
        </div>
      )}
    </Accordion>
  );
}

