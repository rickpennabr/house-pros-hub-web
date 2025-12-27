'use client';

import { TbUserEdit } from 'react-icons/tb';
import { MapPin } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';
import { EstimateSchema } from '@/lib/schemas/estimate';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import AddressAutocomplete, { AddressData } from '@/components/AddressAutocomplete';
import Accordion from '@/components/ui/Accordion';
import { formatPhoneNumber } from '@/lib/utils/phoneFormat';

interface CustomerInfoAccordionProps {
  isOpen: boolean;
  onToggle: () => void;
  isComplete: boolean;
  methods: UseFormReturn<EstimateSchema>;
  errors: UseFormReturn<EstimateSchema>['formState']['errors'];
  isSubmitting: boolean;
  onAddressSelect: (addressData: AddressData) => void;
  tFields: (key: string) => string;
  tAccordion: (key: string) => string;
}

export default function CustomerInfoAccordion({
  isOpen,
  onToggle,
  isComplete,
  methods,
  errors,
  isSubmitting,
  onAddressSelect,
  tFields,
  tAccordion,
}: CustomerInfoAccordionProps) {
  const { register, watch, setValue } = methods;
  const streetAddress = watch('streetAddress');

  // Check if there are any errors in customer info fields
  const hasErrors = Boolean(
    errors.firstName ||
    errors.lastName ||
    errors.email ||
    errors.phone ||
    errors.streetAddress ||
    errors.city ||
    errors.state ||
    errors.zipCode
  );

  // Show missing info indicator when accordion is collapsed and info is incomplete
  const showMissingInfo = !isOpen && !isComplete;

  return (
    <Accordion
      title={tAccordion('customerInfo')}
      isOpen={isOpen}
      onToggle={onToggle}
      isComplete={isComplete}
      icon={<TbUserEdit className="w-5 h-5" />}
      required
      hasErrors={hasErrors || !isComplete}
      missingInfoMessage={showMissingInfo ? tAccordion('missingRequiredInfo') : undefined}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label={tFields('firstNameLabel')} required error={errors.firstName?.message}>
          <Input
            {...register('firstName')}
            placeholder={tFields('firstNamePlaceholder')}
            disabled={isSubmitting}
            error={errors.firstName?.message}
          />
        </FormField>

        <FormField label={tFields('lastNameLabel')} required error={errors.lastName?.message}>
          <Input
            {...register('lastName')}
            placeholder={tFields('lastNamePlaceholder')}
            disabled={isSubmitting}
            error={errors.lastName?.message}
          />
        </FormField>
      </div>

      <FormField label={tFields('emailLabel')} required error={errors.email?.message}>
        <Input
          {...register('email')}
          type="email"
          placeholder={tFields('emailPlaceholder')}
          disabled={isSubmitting}
          error={errors.email?.message}
        />
      </FormField>

      <FormField label={tFields('phoneLabel')} required error={errors.phone?.message}>
        <Input
          {...register('phone')}
          type="tel"
          placeholder={tFields('phonePlaceholder')}
          disabled={isSubmitting}
          error={errors.phone?.message}
          onChange={(e) => {
            const formatted = formatPhoneNumber(e.target.value);
            setValue('phone', formatted, { shouldValidate: true });
          }}
        />
      </FormField>

      <div className="pt-2 border-t-2 border-gray-200">
        <div className="flex items-center gap-2 mb-3">
          <MapPin className="w-5 h-5 text-red-600" />
          <h3 className="text-lg font-semibold text-black">{tAccordion('projectAddress')}</h3>
        </div>

        <FormField label={tFields('streetAddressLabel')} required error={errors.streetAddress?.message}>
          <AddressAutocomplete
            value={streetAddress || ''}
            onChange={(value) => setValue('streetAddress', value, { shouldValidate: true })}
            onAddressSelect={onAddressSelect}
            placeholder={tFields('streetAddressPlaceholder')}
            disabled={isSubmitting}
            required
          />
        </FormField>

        <FormField label={tFields('apartmentLabel')} error={errors.apartment?.message}>
          <Input
            {...register('apartment')}
            placeholder={tFields('apartmentPlaceholder')}
            disabled={isSubmitting}
            error={errors.apartment?.message}
          />
        </FormField>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <FormField label={tFields('cityLabel')} required error={errors.city?.message}>
            <Input
              {...register('city')}
              placeholder={tFields('cityPlaceholder')}
              disabled={isSubmitting}
              error={errors.city?.message}
            />
          </FormField>

          <FormField label={tFields('stateLabel')} required error={errors.state?.message}>
            <Input
              {...register('state')}
              maxLength={2}
              placeholder={tFields('statePlaceholder')}
              disabled={isSubmitting}
              error={errors.state?.message}
            />
          </FormField>

          <FormField label={tFields('zipCodeLabel')} required error={errors.zipCode?.message}>
            <Input
              {...register('zipCode')}
              placeholder={tFields('zipCodePlaceholder')}
              maxLength={10}
              disabled={isSubmitting}
              error={errors.zipCode?.message}
            />
          </FormField>
        </div>
      </div>
    </Accordion>
  );
}

