'use client';

import Link from 'next/link';
import { SignupFormState } from '../../hooks/useSignupForm';

interface ContractorStep4Props {
  formState: SignupFormState;
  updateField: <K extends keyof SignupFormState>(field: K, value: SignupFormState[K]) => void;
  fieldErrors?: { [key: string]: string | undefined };
}

export function ContractorStep4({ formState, updateField, fieldErrors = {} }: ContractorStep4Props) {
  return (
    <div className="space-y-6 flex-1">
      <div>
        <label className="flex items-start">
          <input
            type="checkbox"
            checked={formState.agreeToTerms}
            onChange={(e) => updateField('agreeToTerms', e.target.checked)}
            className="w-4 h-4 mt-0.5 border-2 border-black rounded focus:ring-2 focus:ring-black"
            disabled={formState.isLoading}
          />
          <span className="ml-2 text-sm text-gray-600">
            By clicking Sign up you agree with the{' '}
            <Link href="/legal/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-black">
              Terms of Service
            </Link>
            {' '}and{' '}
            <Link href="/legal/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-black">
              Privacy Policy
            </Link>
            {' '}to create a personal account.
          </span>
        </label>
      </div>
    </div>
  );
}

