'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { FormField } from '@/components/ui/FormField';
import { SignupSchema } from '@/lib/schemas/auth';
import { formatPhoneNumber } from '@/lib/utils/phoneFormat';

export function CustomerStep3() {
  const locale = useLocale();
  const tFields = useTranslations('auth.signup.fields');
  const tTerms = useTranslations('auth.signup.terms');
  const { register, setValue, watch, formState: { errors, isSubmitting } } = useFormContext<SignupSchema>();

  return (
    <div className="space-y-6 flex-1 animate-fade-in">
      <FormField label={tFields('phoneLabel')} required error={errors.phone?.message}>
        <Input
          {...register('phone')}
          id="phone"
          type="tel"
          value={watch('phone') || ''}
          onChange={(e) => {
            const formatted = formatPhoneNumber(e.target.value);
            setValue('phone', formatted);
          }}
          onClear={() => setValue('phone', '')}
          showClear
          required
          placeholder={tFields('phonePlaceholder')}
          disabled={isSubmitting}
          error={errors.phone?.message}
        />
      </FormField>

      <FormField label={tFields('emailLabel')} required error={errors.email?.message}>
        <Input
          {...register('email')}
          id="signup-email"
          type="email"
          onClear={() => setValue('email', '')}
          showClear
          required
          placeholder={tFields('emailPlaceholder')}
          disabled={isSubmitting}
          error={errors.email?.message}
        />
      </FormField>

      <PasswordInput
        {...register('password')}
        id="signup-password"
        label={tFields('passwordLabel')}
        required
        placeholder={tFields('passwordPlaceholder')}
        disabled={isSubmitting}
        error={errors.password?.message}
      />

      <PasswordInput
        {...register('confirmPassword')}
        id="confirm-password"
        label={tFields('repeatPasswordLabel')}
        required
        placeholder={tFields('repeatPasswordPlaceholder')}
        disabled={isSubmitting}
        error={errors.confirmPassword?.message}
      />

      <div>
        <label className="flex items-start">
          <input
            {...register('agreeToTerms')}
            type="checkbox"
            className="w-4 h-4 mt-0.5 border-2 border-black rounded accent-black checked:bg-black checked:border-black"
            style={{ accentColor: 'black' }}
            disabled={isSubmitting}
          />
          <span className="ml-2 text-sm text-gray-600">
            {tTerms('prefix')}{' '}
            <Link href={`/${locale}/legal/terms`} target="_blank" rel="noopener noreferrer" className="underline hover:text-black">
              {tTerms('termsOfService')}
            </Link>
            {' '}{tTerms('and')}{' '}
            <Link href={`/${locale}/legal/privacy`} target="_blank" rel="noopener noreferrer" className="underline hover:text-black">
              {tTerms('privacyPolicy')}
            </Link>
            {' '}{tTerms('suffix')}
          </span>
        </label>
        {errors.agreeToTerms && (
          <p className="mt-1 text-xs text-red-600">{errors.agreeToTerms.message}</p>
        )}
      </div>
    </div>
  );
}

