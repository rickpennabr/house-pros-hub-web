'use client';

import { useFormContext } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { SignupSchema } from '@/lib/schemas/auth';
import { formatPhoneNumber } from '@/lib/utils/phoneFormat';

export function ContractorStep3() {
  const tFields = useTranslations('auth.signup.fields');
  const { register, setValue, watch, formState: { isSubmitting } } = useFormContext<SignupSchema>();

  return (
    <div className="space-y-6 flex-1 animate-fade-in">
      <FormField label={tFields('locationPhoneLabel')}>
        <Input
          {...register('phone')}
          id="locationPhone"
          type="tel"
          value={watch('phone') || ''}
          onChange={(e) => {
            const formatted = formatPhoneNumber(e.target.value);
            setValue('phone', formatted);
          }}
          onClear={() => setValue('phone', '')}
          showClear
          placeholder={tFields('locationPhonePlaceholder')}
          disabled={isSubmitting}
        />
      </FormField>

      <FormField label={tFields('mobilePhoneLabel')}>
        <Input
          {...register('mobilePhone')} 
          id="mobilePhone"
          type="tel"
          value={watch('mobilePhone') || ''}
          onChange={(e) => {
            const formatted = formatPhoneNumber(e.target.value);
            setValue('mobilePhone', formatted);
          }}
          onClear={() => setValue('mobilePhone', '')}
          showClear
          placeholder={tFields('mobilePhonePlaceholder')}
          disabled={isSubmitting}
        />
      </FormField>
    </div>
  );
}

