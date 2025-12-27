'use client';

import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { AddressData } from '@/components/AddressAutocomplete';
import type { BusinessFormValues } from '@/lib/schemas/business';

interface BusinessStep2Props {
  handleAddressSelect: (addressData: AddressData) => void;
  handleAddressChange: (value: string) => void;
  applyPersonalAddress: () => void;
  personalData?: {
    address?: string;
    streetAddress?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    apartment?: string;
  };
}

export function BusinessStep2({
  handleAddressSelect,
  handleAddressChange,
  applyPersonalAddress,
  personalData,
}: BusinessStep2Props) {
  const t = useTranslations('businessForm.address');
  const { register, setValue, watch, formState: { errors, isSubmitting } } = useFormContext<BusinessFormValues>();
  const [usePersonalAddressChecked, setUsePersonalAddressChecked] = useState(false);

  const address = watch('address');
  const hasPersonalAddress = !!(personalData?.streetAddress || personalData?.address || personalData?.city || personalData?.zipCode);

  const handleCheckboxChange = (checked: boolean) => {
    setUsePersonalAddressChecked(checked);
    if (checked) {
      applyPersonalAddress();
    }
  };

  return (
    <div className="space-y-6 flex-1">
      <FormField label={t('businessAddressLabel')} required error={errors.streetAddress?.message}>
        {personalData && (
          <div className="flex items-center justify-start mb-2">
            <label
              className={`flex items-center gap-2 cursor-pointer ${!hasPersonalAddress ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <span className="text-xs text-gray-700">{t('sameAsPersonal')}</span>
              <input
                type="checkbox"
                checked={usePersonalAddressChecked}
                onChange={(e) => handleCheckboxChange(e.target.checked)}
                disabled={isSubmitting || !hasPersonalAddress}
                className="w-4 h-4 border-2 border-black rounded accent-black"
              />
            </label>
          </div>
        )}
        <AddressAutocomplete
          id="business-address"
          value={address || ''}
          onChange={handleAddressChange}
          onAddressSelect={handleAddressSelect}
          placeholder={t('addressPlaceholder')}
          disabled={isSubmitting}
        />
      </FormField>

      <input type="hidden" {...register('streetAddress')} />

      <FormField label={t('apartmentLabel')}>
        <Input
          {...register('apartment')}
          id="apartment"
          type="text"
          value={watch('apartment') || ''}
          onClear={() => setValue('apartment', '')}
          showClear
          placeholder={t('apartmentPlaceholder')}
          disabled={isSubmitting}
        />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField label={t('cityLabel')} required error={errors.city?.message}>
          <Input
            {...register('city')}
            id="city"
            type="text"
            value={watch('city') || ''}
            onClear={() => setValue('city', '')}
            showClear
            required
            placeholder={t('cityPlaceholder')}
            disabled={isSubmitting}
            error={errors.city?.message}
          />
        </FormField>

        <FormField label={t('stateLabel')} required error={errors.state?.message}>
          <Input
            {...register('state')}
            id="state"
            type="text"
            value={watch('state') || ''}
            onClear={() => setValue('state', '')}
            showClear
            required
            placeholder={t('statePlaceholder')}
            disabled={isSubmitting}
            error={errors.state?.message}
          />
        </FormField>
      </div>

      <FormField label={t('zipLabel')} required error={errors.zipCode?.message}>
        <Input
          {...register('zipCode')}
          id="zipCode"
          type="text"
          value={watch('zipCode') || ''}
          onClear={() => setValue('zipCode', '')}
          showClear
          required
          placeholder={t('zipPlaceholder')}
          disabled={isSubmitting}
          error={errors.zipCode?.message}
        />
      </FormField>
    </div>
  );
}

