'use client';

import React, { useState } from 'react';
import { useFormContext, useFieldArray } from 'react-hook-form';
import type { FieldPath } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { RESIDENTIAL_CONTRACTOR_LICENSES } from '@/lib/constants/contractorLicenses';
import { X, FileText, GripVertical, ChevronDown, ChevronUp } from 'lucide-react';
import type { BusinessFormValues } from '@/lib/schemas/business';

interface BusinessStepLicensesProps {
  reorderLicenses?: (fromIndex: number, toIndex: number) => void;
}

export function BusinessStepLicenses({ reorderLicenses }: BusinessStepLicensesProps) {
  const t = useTranslations('businessForm.licenses');
  const { register, control, setValue, watch, setError, clearErrors, formState: { errors, isSubmitting } } = useFormContext<BusinessFormValues>();
  
  const { fields, prepend, remove, move } = useFieldArray({
    control,
    name: 'licenses',
  });

  const licenses = watch('licenses');
  const [showExplanation, setShowExplanation] = useState(true);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const licenseErrors = errors.licenses as unknown as
    | Array<{
        license?: { message?: string; type?: string };
        licenseNumber?: { message?: string; type?: string };
      }>
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
      if (reorderLicenses) {
        reorderLicenses(draggedIndex, dropIndex);
      } else {
        move(draggedIndex, dropIndex);
      }
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="space-y-6 flex-1">
      {/* Instructions Section - Similar to Links */}
      <div className="border-2 border-black rounded-lg bg-white">
        <button
          type="button"
          onClick={() => setShowExplanation(!showExplanation)}
          className="w-full flex items-center justify-between p-2 text-left bg-black text-white"
        >
          <label className="block text-base font-bold text-white">{t('instructionsTitle') || 'License Ordering Instructions'}</label>
          {showExplanation ? <ChevronUp className="w-5 h-5 text-white" /> : <ChevronDown className="w-5 h-5 text-white" />}
        </button>
        {showExplanation && (
          <div className="px-4 pb-4">
            <div className="bg-white rounded-lg mt-4 text-xs md:text-base text-red-500">
              <ul className="space-y-1 list-disc list-inside">
                <li>{t('instructionsLine1') || 'Your digital business card will display licenses'}</li>
                <li>{t('instructionsLine2') || 'You can add and drag licenses to display them in the order you want.'}</li>
                <li>{t('instructionsLine3') || 'Each license classification and number must be unique'}</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Licenses Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">
              {t('contractorLicensesLabel')} <span className="text-red-500">*</span>
            </label>
            <span className="text-xs text-gray-500">
              {t('contractorLicensesHelp')}
            </span>
          </div>
          <button
            type="button"
            onClick={() => prepend({ license: '', licenseNumber: '' })}
            className="px-3 py-1.5 text-sm border-2 border-black rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            disabled={isSubmitting}
          >
            {t('addLicenseButton')}
          </button>
        </div>

        {/* Header Row - Similar to Links */}
        <div className="grid grid-cols-[25%_75%] md:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] gap-4 pr-2 md:pr-0">
          <div className="bg-black text-white font-semibold px-2 py-2 rounded-lg text-center truncate">{t('position')}</div>
          <div className="bg-black text-white font-semibold px-4 py-2 rounded-lg text-center">{t('license')}</div>
        </div>

        {fields.length === 0 ? (
          <div className="text-center py-8 text-gray-500">{t('noLicenses')}</div>
        ) : (
          <div className="space-y-3 transition-all duration-300">
            {fields.map((field, index) => {
              return (
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
                  {/* Position Number */}
                  <div className="flex justify-center">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold bg-black text-white transition-all duration-300">
                      {index + 1}
                    </div>
                  </div>

                  {/* License Card - Similar to Link Card */}
                  <div className={`border-2 border-black rounded-lg bg-white p-4 relative transition-all duration-300 ${
                    draggedIndex === index 
                      ? 'opacity-50 scale-95 rotate-1 shadow-lg' 
                      : draggedIndex !== null
                      ? 'opacity-100'
                      : 'opacity-100'
                  }`}>
                    {/* Highlight drop target */}
                    {dragOverIndex === index && draggedIndex !== null && draggedIndex !== index && (
                      <div className="absolute inset-0 ring-2 ring-red-500 rounded-lg pointer-events-none animate-pulse" />
                    )}
                    {fields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="absolute top-2 right-2 text-red-500 cursor-pointer transition-opacity duration-200 hover:opacity-70"
                        disabled={isSubmitting}
                        aria-label={t('removeLicenseAria', { index: index + 1 })}
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                    
                    {/* Header with License label and icon */}
                    <div className="flex items-center gap-1 mb-4">
                      {fields.length > 1 && (
                        <div 
                          draggable 
                          onDragStart={(e) => handleDragStart(e, index)} 
                          onDragEnd={() => setDraggedIndex(null)} 
                          className="-ml-1 cursor-move transition-transform duration-200 hover:scale-110 active:scale-95"
                        >
                          <GripVertical className="w-5 h-5 text-black transition-colors duration-200" />
                        </div>
                      )}
                      <FileText className="w-4 h-4 text-red-500" />
                      <div className="text-sm font-medium">{t('license')}</div>
                    </div>

                    {/* Form Fields */}
                    <div className="space-y-3">
                      <FormField
                        label={t('licenseClassificationLabel')}
                        required
                        error={licenseErrors?.[index]?.license?.message}
                      >
                        <select
                          {...register(`licenses.${index}.license` as FieldPath<BusinessFormValues>)}
                          onChange={(e) => {
                            const val = e.target.value;
                            // Check if this classification is already selected in another field
                            const isDuplicate = licenses?.some((l, i) => i !== index && l.license === val && val.trim() !== '');
                            
                            if (val && isDuplicate) {
                              setError(`licenses.${index}.license` as FieldPath<BusinessFormValues>, {
                                type: 'manual',
                                message: t('duplicateLicenseError') || 'This license classification has already been added'
                              });
                              // Reset the field to prevent duplicate
                              setValue(`licenses.${index}.license` as FieldPath<BusinessFormValues>, '');
                            } else {
                              setValue(`licenses.${index}.license` as FieldPath<BusinessFormValues>, val);
                              if (licenseErrors?.[index]?.license?.type === 'manual') {
                                clearErrors(`licenses.${index}.license` as FieldPath<BusinessFormValues>);
                              }
                            }
                          }}
                          required
                          className={`w-full px-2 py-3 border-2 rounded-lg bg-white focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                            licenseErrors?.[index]?.license
                              ? 'border-red-500 focus:border-red-500'
                              : 'border-black'
                          }`}
                          disabled={isSubmitting}
                        >
                          <option value="">{t('licenseClassificationPlaceholder')}</option>
                          <option value="GENERAL">GENERAL - General Contractor License</option>
                          {RESIDENTIAL_CONTRACTOR_LICENSES.map((license) => (
                            <option key={license.code} value={license.code}>
                              {license.code} - {license.name}
                            </option>
                          ))}
                        </select>
                      </FormField>

                      <FormField 
                        label={t('licenseNumberLabel')} 
                        required
                        error={licenseErrors?.[index]?.licenseNumber?.message}
                      >
                        <Input
                          {...register(`licenses.${index}.licenseNumber` as FieldPath<BusinessFormValues>)}
                          type="text"
                          value={licenses?.[index]?.licenseNumber || ''}
                          onChange={(e) => {
                            const val = e.target.value.trim();
                            // Check if this license number is already entered in another field
                            const isDuplicate = licenses?.some((l, i) => i !== index && l.licenseNumber?.trim() === val && val !== '');
                            
                            if (val && isDuplicate) {
                              setError(`licenses.${index}.licenseNumber` as FieldPath<BusinessFormValues>, {
                                type: 'manual',
                                message: t('duplicateLicenseNumberError') || 'This license number has already been entered'
                              });
                            } else {
                              setValue(`licenses.${index}.licenseNumber` as FieldPath<BusinessFormValues>, val);
                              if (licenseErrors?.[index]?.licenseNumber?.type === 'manual') {
                                clearErrors(`licenses.${index}.licenseNumber` as FieldPath<BusinessFormValues>);
                              }
                            }
                          }}
                          onClear={() => {
                            setValue(`licenses.${index}.licenseNumber` as FieldPath<BusinessFormValues>, '');
                            clearErrors(`licenses.${index}.licenseNumber` as FieldPath<BusinessFormValues>);
                          }}
                          showClear
                          placeholder={t('licenseNumberPlaceholder')}
                          disabled={isSubmitting}
                          required
                          error={licenseErrors?.[index]?.licenseNumber?.message}
                        />
                      </FormField>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
