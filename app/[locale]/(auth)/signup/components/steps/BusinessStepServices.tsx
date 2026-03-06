'use client';

import React, { useState } from 'react';
import { useFormContext, useFieldArray } from 'react-hook-form';
import type { FieldPath } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { X, Wrench, GripVertical, ChevronDown, ChevronUp } from 'lucide-react';
import type { BusinessFormValues } from '@/lib/schemas/business';

interface BusinessStepServicesProps {
  reorderServices?: (fromIndex: number, toIndex: number) => void;
}

export function BusinessStepServices({ reorderServices }: BusinessStepServicesProps) {
  const t = useTranslations('businessForm.services');
  const { register, control, setValue, watch, formState: { errors, isSubmitting } } = useFormContext<BusinessFormValues>();

  const { fields, prepend, remove, move } = useFieldArray({
    control,
    name: 'services',
  });

  const services = watch('services');
  const [showExplanation, setShowExplanation] = useState(true);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const serviceErrors = errors.services as unknown as
    | Array<{ name?: { message?: string } }>
    | undefined;

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', '');
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      if (reorderServices) {
        reorderServices(draggedIndex, dropIndex);
      } else {
        move(draggedIndex, dropIndex);
      }
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="space-y-6 flex-1">
      <div className="border-2 border-black rounded-lg bg-white">
        <button
          type="button"
          onClick={() => setShowExplanation(!showExplanation)}
          className="w-full flex items-center justify-between p-2 text-left bg-black text-white"
        >
          <label className="block text-base font-bold text-white">{t('instructionsTitle')}</label>
          {showExplanation ? <ChevronUp className="w-5 h-5 text-white" /> : <ChevronDown className="w-5 h-5 text-white" />}
        </button>
        {showExplanation && (
          <div className="px-4 pb-4">
            <div className="bg-white rounded-lg mt-4 text-xs md:text-base text-red-500">
              <ul className="space-y-1 list-disc list-inside">
                <li>{t('instructionsLine1')}</li>
                <li>{t('instructionsLine2')}</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-8">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">
              {t('sectionTitle')}
            </label>
            <span className="text-xs text-gray-500">
              {t('servicesHelp')}
            </span>
          </div>
          <button
            type="button"
            onClick={() => prepend({ name: '' })}
            className="px-3 py-1.5 text-sm border-2 border-black rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap shrink-0"
            disabled={isSubmitting}
          >
            {t('addServiceButton')}
          </button>
        </div>

        <div className="grid grid-cols-[25%_75%] md:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] gap-4 pr-2 md:pr-0">
          <div className="bg-black text-white font-semibold px-2 py-2 rounded-lg text-center truncate">{t('position')}</div>
          <div className="bg-black text-white font-semibold px-4 py-2 rounded-lg text-center">{t('service')}</div>
        </div>

        {fields.length === 0 ? (
          <div className="text-center py-8 text-gray-500">{t('noServices')}</div>
        ) : (
          <div className="space-y-3 transition-all duration-300">
            {fields.map((field, index) => (
              <div
                key={field.id}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={() => setDragOverIndex(null)}
                onDrop={(e) => handleDrop(e, index)}
                className={`grid grid-cols-[25%_75%] md:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] gap-4 items-center pr-2 md:pr-0 transition-all duration-300 ${
                  dragOverIndex === index && draggedIndex !== null && draggedIndex !== index
                    ? 'transform translate-y-2'
                    : ''
                }`}
              >
                <div className="flex justify-center">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold bg-black text-white transition-all duration-300">
                    {index + 1}
                  </div>
                </div>

                <div className={`border-2 border-black rounded-lg bg-white pt-4 px-4 pb-2 relative transition-all duration-300 ${
                  draggedIndex === index
                    ? 'opacity-50 scale-95 rotate-1 shadow-lg'
                    : 'opacity-100'
                }`}>
                  {dragOverIndex === index && draggedIndex !== null && draggedIndex !== index && (
                    <div className="absolute inset-0 ring-2 ring-red-500 rounded-lg pointer-events-none animate-pulse" />
                  )}
                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="absolute top-2 right-2 text-red-500 cursor-pointer transition-opacity duration-200 hover:opacity-70"
                      disabled={isSubmitting}
                      aria-label={t('removeServiceAria', { index: index + 1 })}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}

                  <FormField
                    label={
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                        {fields.length > 1 && (
                          <div
                            draggable
                            onDragStart={(e) => handleDragStart(e, index)}
                            onDragEnd={() => setDraggedIndex(null)}
                            className="-ml-1 cursor-move transition-transform duration-200 hover:scale-110 active:scale-95 shrink-0"
                          >
                            <GripVertical className="w-5 h-5 text-black transition-colors duration-200" />
                          </div>
                        )}
                        <Wrench className="w-4 h-4 text-red-500 shrink-0" />
                        {t('serviceNameLabel')}
                      </span>
                    }
                    error={serviceErrors?.[index]?.name?.message}
                  >
                    <Input
                      {...register(`services.${index}.name` as FieldPath<BusinessFormValues>)}
                      type="text"
                      value={services?.[index]?.name ?? ''}
                      onClear={() => setValue(`services.${index}.name` as FieldPath<BusinessFormValues>, '')}
                      showClear
                      placeholder={t('serviceNamePlaceholder')}
                      disabled={isSubmitting}
                      error={serviceErrors?.[index]?.name?.message}
                    />
                  </FormField>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
