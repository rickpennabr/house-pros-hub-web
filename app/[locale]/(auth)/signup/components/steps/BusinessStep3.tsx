'use client';

import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import type { BusinessFormValues } from '@/lib/schemas/business';
import { formatPhoneNumber } from '@/lib/utils/phoneFormat';

interface BusinessStep3Props {
  applyPersonalEmail: () => void;
  applyPersonalPhone: () => void;
  applyPersonalMobilePhone: () => void;
  personalData?: {
    email?: string;
    phone?: string;
    mobilePhone?: string;
  };
}

export function BusinessStep3({
  applyPersonalEmail,
  applyPersonalPhone,
  applyPersonalMobilePhone,
  personalData,
}: BusinessStep3Props) {
  const t = useTranslations('businessForm.contact');
  const { register, setValue, watch, formState: { errors, isSubmitting } } = useFormContext<BusinessFormValues>();
  const [usePersonalEmailChecked, setUsePersonalEmailChecked] = useState(false);
  const [usePersonalPhoneChecked, setUsePersonalPhoneChecked] = useState(false);
  const [usePersonalMobilePhoneChecked, setUsePersonalMobilePhoneChecked] = useState(false);

  const hasPersonalEmail = !!personalData?.email;
  const hasPersonalPhone = !!(personalData?.phone || personalData?.mobilePhone);
  const hasPersonalMobilePhone = !!(personalData?.mobilePhone || personalData?.phone);

  const handleEmailCheckboxChange = (checked: boolean) => {
    setUsePersonalEmailChecked(checked);
    if (checked) {
      applyPersonalEmail();
    }
  };

  const handlePhoneCheckboxChange = (checked: boolean) => {
    setUsePersonalPhoneChecked(checked);
    if (checked) {
      applyPersonalPhone();
    }
  };

  const handleMobilePhoneCheckboxChange = (checked: boolean) => {
    setUsePersonalMobilePhoneChecked(checked);
    if (checked) {
      applyPersonalMobilePhone();
    }
  };

  return (
    <div className="space-y-6 flex-1">
      <FormField label={t('businessEmailLabel')} error={errors.email?.message}>
        {personalData && (
          <div className="flex items-center justify-start mb-2">
            <label className={`flex items-center gap-2 cursor-pointer ${!hasPersonalEmail ? 'opacity-60 cursor-not-allowed' : ''}`}>
              <span className="text-xs text-gray-700">{t('sameAsPersonal')}</span>
              <input
                type="checkbox"
                checked={usePersonalEmailChecked}
                onChange={(e) => handleEmailCheckboxChange(e.target.checked)}
                disabled={isSubmitting || !hasPersonalEmail}
                className="w-4 h-4 border-2 border-black rounded accent-black"
              />
            </label>
          </div>
        )}
        <Input
          {...register('email')}
          id="business-email"
          type="email"
          value={watch('email') || ''}
          onClear={() => setValue('email', '')}
          showClear
          placeholder={t('businessEmailPlaceholder')}
          disabled={isSubmitting}
          error={errors.email?.message}
        />
      </FormField>

      <FormField label={t('landPhoneLabel')} error={errors.phone?.message}>
        {personalData && (
          <div className="flex items-center justify-start mb-2">
            <label className={`flex items-center gap-2 cursor-pointer ${!hasPersonalPhone ? 'opacity-60 cursor-not-allowed' : ''}`}>
              <span className="text-xs text-gray-700">{t('sameAsPersonal')}</span>
              <input
                type="checkbox"
                checked={usePersonalPhoneChecked}
                onChange={(e) => handlePhoneCheckboxChange(e.target.checked)}
                disabled={isSubmitting || !hasPersonalPhone}
                className="w-4 h-4 border-2 border-black rounded accent-black"
              />
            </label>
          </div>
        )}
        <Input
          {...register('phone')}
          id="land-phone"
          type="tel"
          value={watch('phone') || ''}
          onChange={(e) => {
            const formatted = formatPhoneNumber(e.target.value);
            setValue('phone', formatted);
          }}
          onClear={() => setValue('phone', '')}
          showClear
          placeholder={t('landPhonePlaceholder')}
          disabled={isSubmitting}
          error={errors.phone?.message}
        />
      </FormField>

      <FormField label={t('mobilePhoneLabel')} error={errors.mobilePhone?.message}>
        {personalData && (
          <div className="flex items-center justify-start mb-2">
            <label className={`flex items-center gap-2 cursor-pointer ${!hasPersonalMobilePhone ? 'opacity-60 cursor-not-allowed' : ''}`}>
              <span className="text-xs text-gray-700">{t('sameAsPersonal')}</span>
              <input
                type="checkbox"
                checked={usePersonalMobilePhoneChecked}
                onChange={(e) => handleMobilePhoneCheckboxChange(e.target.checked)}
                disabled={isSubmitting || !hasPersonalMobilePhone}
                className="w-4 h-4 border-2 border-black rounded accent-black"
              />
            </label>
          </div>
        )}
        <Input
          {...register('mobilePhone')}
          id="mobile-phone"
          type="tel"
          value={watch('mobilePhone') || ''}
          onChange={(e) => {
            const formatted = formatPhoneNumber(e.target.value);
            setValue('mobilePhone', formatted);
          }}
          onClear={() => setValue('mobilePhone', '')}
          showClear
          placeholder={t('mobilePhonePlaceholder')}
          disabled={isSubmitting}
          error={errors.mobilePhone?.message}
        />
      </FormField>
    </div>
  );
}

