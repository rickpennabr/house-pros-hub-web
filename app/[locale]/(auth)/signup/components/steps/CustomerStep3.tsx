'use client';

import Link from 'next/link';
import { useCallback, useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useFormContext } from 'react-hook-form';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { FormField } from '@/components/ui/FormField';
import { TipModal } from '@/components/ui/TipModal';
import { SignupSchema } from '@/lib/schemas/auth';
import { USER_TYPES } from '@/lib/constants/auth';
import { formatPhoneNumber } from '@/lib/utils/phoneFormat';
import { useTypingPlaceholder } from '@/hooks/useTypingPlaceholder';

export function CustomerStep3() {
  const locale = useLocale();
  const tFields = useTranslations('auth.signup.fields');
  const tTerms = useTranslations('auth.signup.terms');
  const tChat = useTranslations('auth.signup.chat');
  const { register, setValue, watch, setError, clearErrors, getValues, formState: { errors, isSubmitting } } = useFormContext<SignupSchema>();

  const handleEmailBlur = useCallback(async () => {
    const email = String(getValues('email') ?? '').trim().toLowerCase();
    if (!email) return;
    try {
      const res = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.available === false) {
        setError('email', { type: 'manual', message: tChat('emailAlreadyExists') });
      } else {
        clearErrors('email');
      }
    } catch {
      // ignore
    }
  }, [getValues, setError, clearErrors, tChat]);
  const userType = watch('userType');
  const isContractor = userType === USER_TYPES.CONTRACTOR;

  // Typing animation for placeholders
  const phonePlaceholder = tFields('phonePlaceholder');
  const emailPlaceholder = tFields('emailPlaceholder');
  const passwordPlaceholder = tFields('passwordPlaceholder');
  const repeatPasswordPlaceholder = tFields('repeatPasswordPlaceholder');
  const placeholders = useMemo(
    () => [phonePlaceholder, emailPlaceholder, passwordPlaceholder, repeatPasswordPlaceholder],
    [phonePlaceholder, emailPlaceholder, passwordPlaceholder, repeatPasswordPlaceholder]
  );
  const animatedPlaceholders = useTypingPlaceholder({
    placeholders,
    typingSpeed: 100,
    delayBetweenFields: 300,
    startDelay: 500,
  });

  return (
    <div className="space-y-6 flex-1 animate-fade-in">
      <FormField 
        label={
          <span className="flex items-center">
            <span className="animate-icon-slide-in-email">
              <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </span>
            <span>{tFields('phoneLabel')}</span>
          </span>
        } 
        required 
        error={errors.phone?.message}
        tip="For contact and unique identification purpose"
      >
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
          placeholder={animatedPlaceholders[0]}
          disabled={isSubmitting}
          error={errors.phone?.message}
        />
      </FormField>

      <FormField 
        label={
          <span className="flex items-center">
            <span className="animate-icon-slide-in-email-step3">
              <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </span>
            <span>{tFields('emailLabel')}</span>
          </span>
        } 
        required 
        error={errors.email?.message}
        tip="For contact and unique identification purpose"
      >
        <Input
          {...register('email')}
          id="signup-email"
          type="email"
          onBlur={(e) => {
            register('email').onBlur(e);
            void handleEmailBlur();
          }}
          onClear={() => setValue('email', '')}
          showClear
          required
          placeholder={animatedPlaceholders[1]}
          disabled={isSubmitting}
          error={errors.email?.message}
        />
      </FormField>

      <PasswordInput
        {...register('password')}
        id="signup-password"
        label={
          <span className="flex items-center">
            <span className="animate-icon-slide-in-password-step3">
              <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </span>
            <span>{tFields('passwordLabel')}</span>
          </span>
        }
        required
        placeholder={animatedPlaceholders[2]}
        disabled={isSubmitting}
        error={errors.password?.message}
        tip="For security purpose. Password must be at least 8 characters and contain at least one uppercase letter, one lowercase letter, and one number."
      />

      <PasswordInput
        {...register('confirmPassword')}
        id="confirm-password"
        label={tFields('repeatPasswordLabel')}
        required
        placeholder={animatedPlaceholders[3]}
        disabled={isSubmitting}
        error={errors.confirmPassword?.message}
      />

      {isContractor && (
        <FormField
          label={tFields('invitationCodeLabel')}
          required
          error={errors.invitationCode?.message}
          tip="Enter the code you received from House Pros Hub to sign up as a contractor."
        >
          <Input
            {...register('invitationCode')}
            id="invitation-code"
            type="text"
            value={watch('invitationCode') ?? ''}
            onChange={(e) => setValue('invitationCode', e.target.value.trim().toUpperCase())}
            onClear={() => setValue('invitationCode', '')}
            showClear
            required
            placeholder={tFields('invitationCodePlaceholder')}
            disabled={isSubmitting}
            error={errors.invitationCode?.message}
            autoComplete="off"
          />
        </FormField>
      )}

      <div>
        <label className="flex items-start">
          <input
            {...register('agreeToTerms')}
            type="checkbox"
            className="w-4 h-4 mt-0.5 border-2 border-black rounded accent-black checked:bg-black checked:border-black"
            style={{ accentColor: 'black' }}
            disabled={isSubmitting}
          />
          <span className="ml-2 text-sm text-gray-600 flex items-center gap-2 flex-wrap">
            {tTerms('prefix')}{' '}
            <Link href={`/${locale}/legal/terms`} target="_blank" rel="noopener noreferrer" className="underline hover:text-black">
              {tTerms('termsOfService')}
            </Link>
            {' '}{tTerms('and')}{' '}
            <Link href={`/${locale}/legal/privacy`} target="_blank" rel="noopener noreferrer" className="underline hover:text-black">
              {tTerms('privacyPolicy')}
            </Link>
            {' '}{isContractor ? tTerms('suffixContractor') : tTerms('suffix')}{' '}
            <TipModal message="The rules and information on how the platform www.houseproshub.com operates." hoverOnly />
          </span>
        </label>
        {errors.agreeToTerms && (
          <p className="mt-1 text-xs text-red-600">{errors.agreeToTerms.message}</p>
        )}
      </div>

    </div>
  );
}

