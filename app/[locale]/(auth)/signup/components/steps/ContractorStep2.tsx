'use client';

import { useCallback, useMemo } from 'react';
import { useFormContext, useFieldArray } from 'react-hook-form';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { FormField } from '@/components/ui/FormField';
import { Select } from '@/components/ui/Select';
import { RESIDENTIAL_CONTRACTOR_LICENSES } from '@/lib/constants/contractorLicenses';
import { SignupSchema } from '@/lib/schemas/auth';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { useTypingPlaceholder } from '@/hooks/useTypingPlaceholder';

export function ContractorStep2() {
  const tFields = useTranslations('auth.signup.fields');
  const tChat = useTranslations('auth.signup.chat');
  const { isAuthenticated } = useAuth();
  const { register, control, setValue, watch, setError, clearErrors, getValues, trigger, formState: { errors, isSubmitting } } = useFormContext<SignupSchema>();

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
  
  const { fields, prepend, remove } = useFieldArray({
    control,
    name: 'licenses',
  });

  const licenses = watch('licenses');
  const companyRole = watch('companyRole');
  const companyRoleOther = watch('companyRoleOther');

  // Typing animation for placeholders (only when not authenticated)
  const emailPlaceholder = tFields('emailPlaceholder');
  const passwordPlaceholder = tFields('passwordPlaceholder');
  const confirmPasswordPlaceholder = tFields('confirmPasswordPlaceholder');
  const authPlaceholders = useMemo(
    () => [emailPlaceholder, passwordPlaceholder, confirmPasswordPlaceholder],
    [emailPlaceholder, passwordPlaceholder, confirmPasswordPlaceholder]
  );
  const animatedAuthPlaceholders = useTypingPlaceholder({
    placeholders: authPlaceholders,
    typingSpeed: 50,
    delayBetweenFields: 300,
    startDelay: 500,
  });

  const addLicense = () => {
    prepend({ license: '', trade: '' });
  };

  const COMPANY_ROLES = [
    { value: 'Owner', label: 'Owner' },
    { value: 'Manager', label: 'Manager' },
    { value: 'Other', label: 'Other' },
  ];

  return (
    <div className="space-y-6 flex-1 animate-fade-in">
      {/* Only show email/password fields if user is NOT authenticated (new signup) */}
      {!isAuthenticated && (
        <>
          <FormField label={tFields('emailLabel')} required error={errors.email?.message}>
            <Input
              {...register('email')}
              id="signup-email"
              type="email"
              value={watch('email') || ''}
              onBlur={(e) => {
                register('email').onBlur(e);
                void handleEmailBlur();
              }}
              onClear={() => setValue('email', '')}
              showClear
              required
              placeholder={animatedAuthPlaceholders[0]}
              disabled={isSubmitting}
              error={errors.email?.message}
            />
          </FormField>

          <PasswordInput
            {...register('password')}
            id="signup-password"
            label={tFields('passwordLabel')}
            required
            placeholder={animatedAuthPlaceholders[1]}
            disabled={isSubmitting}
            error={errors.password?.message}
          />

          <PasswordInput
            {...register('confirmPassword')}
            id="confirm-password"
            label={tFields('confirmPasswordLabel')}
            required
            placeholder={animatedAuthPlaceholders[2]}
            disabled={isSubmitting}
            error={errors.confirmPassword?.message}
          />
        </>
      )}

      <FormField label={tFields('companyNameLabel')} required error={errors.companyName?.message}>
        <Input
          {...register('companyName')}
          id="companyName"
          type="text"
          value={watch('companyName') || ''}
          onClear={() => setValue('companyName', '')}
          showClear
          required
          placeholder={tFields('companyNamePlaceholder')}
          disabled={isSubmitting}
          error={errors.companyName?.message}
        />
      </FormField>

      <FormField label={tFields('companyRoleLabel')} error={errors.companyRole?.message}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {COMPANY_ROLES.map((role) => {
            const isSelected = companyRole === role.value;
            return (
              <button
                key={role.value}
                type="button"
                onClick={async () => {
                  setValue('companyRole', role.value);
                  if (role.value !== 'Other') {
                    setValue('companyRoleOther', '');
                    // Clear validation error when switching away from Other
                    await trigger('companyRoleOther');
                  }
                }}
                disabled={isSubmitting}
                aria-pressed={isSelected}
                aria-label={`Select ${role.label} as company role`}
                className={`
                  flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all cursor-pointer
                  ${isSelected
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-black border-black hover:bg-gray-50'
                  }
                  ${errors.companyRole ? 'border-red-500' : ''}
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                <span className="text-sm font-medium text-center">{role.label}</span>
              </button>
            );
          })}
        </div>
      </FormField>

      {companyRole === 'Other' && (
        <FormField label={tFields('companyRoleOtherLabel')} required error={errors.companyRoleOther?.message}>
          <Input
            {...register('companyRoleOther')}
            id="companyRoleOther"
            type="text"
            value={companyRoleOther || ''}
            onClear={() => setValue('companyRoleOther', '')}
            showClear
            required
            placeholder={tFields('companyRoleOtherPlaceholder')}
            disabled={isSubmitting}
            error={errors.companyRoleOther?.message}
          />
        </FormField>
      )}

      {/* License Selection */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">
              {tFields('contractorLicensesLabel')} <span className="text-red-500">*</span>
            </label>
            <span className="text-xs text-gray-500">{tFields('contractorLicensesHelp')}</span>
          </div>
          <button
            type="button"
            onClick={addLicense}
            className="px-3 py-1.5 text-sm border-2 border-black rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isSubmitting}
          >
            {tFields('addLicenseButton')}
          </button>
        </div>

        {fields.map((field, index) => (
          <div key={field.id} className="border-2 border-gray-300 rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 space-y-3">
                <FormField 
                  label={`${tFields('licenseClassificationLabel')} ${index + 1}`} 
                  required 
                  error={errors.licenses?.[index]?.license?.message}
                >
                  <Select
                    {...register(`licenses.${index}.license`)}
                    onChange={(e) => {
                      setValue(`licenses.${index}.license`, e.target.value);
                      // Clear license number when classification changes
                      if (e.target.value) {
                        setValue(`licenses.${index}.trade`, '');
                      }
                    }}
                    required
                    disabled={isSubmitting}
                    error={errors.licenses?.[index]?.license?.message}
                  >
                    <option value="">{tFields('licenseClassificationPlaceholder')}</option>
                    {RESIDENTIAL_CONTRACTOR_LICENSES.map((license) => (
                      <option key={license.code} value={license.code}>
                        {license.code} - {license.name}
                      </option>
                    ))}
                  </Select>
                </FormField>

                <FormField 
                  label={tFields('licenseNumberLabel')} 
                  required 
                  error={errors.licenses?.[index]?.trade?.message}
                >
                  <Input
                    {...register(`licenses.${index}.trade`)}
                    type="text"
                    value={licenses?.[index]?.trade || ''}
                    onClear={() => setValue(`licenses.${index}.trade`, '')}
                    showClear
                    placeholder={tFields('licenseNumberPlaceholder')}
                    disabled={isSubmitting}
                    required
                    error={errors.licenses?.[index]?.trade?.message}
                  />
                </FormField>
              </div>

              {fields.length > 1 && (
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="px-2 py-1 text-sm text-red-600 hover:text-red-800 border border-red-300 rounded hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-8"
                  disabled={isSubmitting}
                  aria-label={tFields('removeLicenseAria', { index: index + 1 })}
                >
                  {tFields('remove')}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

