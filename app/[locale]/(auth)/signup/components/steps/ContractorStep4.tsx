'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import { useFormContext } from 'react-hook-form';
import { SignupSchema } from '@/lib/schemas/auth';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';

export function ContractorStep4() {
  const locale = useLocale();
  const { isAuthenticated } = useAuth();
  const { register, setValue, watch, formState: { errors, isSubmitting } } = useFormContext<SignupSchema>();
  
  // Auto-check terms for OAuth users (they already agreed before OAuth)
  useEffect(() => {
    if (isAuthenticated && !watch('agreeToTerms')) {
      setValue('agreeToTerms', true);
    }
  }, [isAuthenticated, setValue, watch]);

  return (
    <div className="space-y-6 flex-1">
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
            By clicking Sign up you agree with the{' '}
            <Link href={`/${locale}/legal/terms`} target="_blank" rel="noopener noreferrer" className="underline hover:text-black">
              Terms of Service
            </Link>
            {' '}and{' '}
            <Link href={`/${locale}/legal/privacy`} target="_blank" rel="noopener noreferrer" className="underline hover:text-black">
              Privacy Policy
            </Link>
            {' '}to create a personal account.
          </span>
        </label>
        {errors.agreeToTerms && (
          <p className="mt-1 text-xs text-red-600">{errors.agreeToTerms.message}</p>
        )}
      </div>
    </div>
  );
}

