'use client';

import { useFormContext } from 'react-hook-form';
import AddressAutocomplete, { AddressData } from '@/components/AddressAutocomplete';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { SignupSchema } from '@/lib/schemas/auth';
import { useTranslations } from 'next-intl';

interface CustomerStep2Props {
  onAddressSelect: (addressData: AddressData) => void;
  onAddressChange: (value: string) => void;
}

export function CustomerStep2({
  onAddressSelect,
  onAddressChange,
}: CustomerStep2Props) {
  const tFields = useTranslations('auth.signup.fields');
  const { register, setValue, watch, formState: { errors, isSubmitting } } = useFormContext<SignupSchema>();
  
  const address = watch('address');
  const addressNote = watch('addressNote');

  return (
    <div className="space-y-6 flex-1 animate-fade-in">
      <FormField label={tFields('searchAddressLabel')} required error={errors.streetAddress?.message}>
        <p className="text-xs text-gray-600 mb-2">
          {tFields('searchAddressHelp')}
        </p>
        <AddressAutocomplete
          id="address"
          value={address || ''}
          onChange={onAddressChange}
          onAddressSelect={onAddressSelect}
          placeholder={tFields('searchAddressPlaceholder')}
          disabled={isSubmitting}
        />
      </FormField>

      <input type="hidden" {...register('streetAddress')} />

      <FormField label={tFields('apartmentLabel')}>
        <Input
          {...register('apartment')}
          id="apartment"
          type="text"
          onClear={() => setValue('apartment', '')}
          showClear
          placeholder={tFields('apartmentPlaceholder')}
          disabled={isSubmitting}
        />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField label={tFields('cityLabel')} required error={errors.city?.message}>
          <Input
            {...register('city')}
            id="city"
            type="text"
            onClear={() => setValue('city', '')}
            showClear
            required
            placeholder={tFields('cityPlaceholder')}
            disabled={isSubmitting}
            error={errors.city?.message}
          />
        </FormField>

        <FormField label={tFields('stateLabel')} required error={errors.state?.message}>
          <Input
            {...register('state')}
            id="state"
            type="text"
            onClear={() => setValue('state', 'NV')}
            showClear
            required
            placeholder={tFields('statePlaceholder')}
            disabled={isSubmitting}
            error={errors.state?.message}
          />
        </FormField>
      </div>

      <FormField label={tFields('zipLabel')} required error={errors.zipCode?.message}>
        <Input
          {...register('zipCode')}
          id="zipCode"
          type="text"
          onClear={() => setValue('zipCode', '')}
          showClear
          required
          placeholder={tFields('zipPlaceholder')}
          disabled={isSubmitting}
          error={errors.zipCode?.message}
        />
      </FormField>

      <FormField label={tFields('gateCodeLabel')}>
        <Input
          {...register('gateCode')}
          id="gateCode"
          type="text"
          onClear={() => setValue('gateCode', '')}
          showClear
          placeholder={tFields('gateCodePlaceholder')}
          disabled={isSubmitting}
        />
      </FormField>

      <FormField label={tFields('addressNoteLabel')}>
        <div className="relative">
          <textarea
            {...register('addressNote')}
            id="addressNote"
            rows={3}
            className="w-full px-2 py-3 pr-8 border-2 border-black rounded-lg bg-white focus:outline-none transition-all resize-none"
            placeholder={tFields('addressNotePlaceholder')}
            disabled={isSubmitting}
          />
          {addressNote && (
            <button
              type="button"
              onClick={() => setValue('addressNote', '')}
              className="absolute right-2 top-2 text-gray-600 hover:text-black transition-colors cursor-pointer"
              disabled={isSubmitting}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-4 h-4"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </FormField>
    </div>
  );
}

