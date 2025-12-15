'use client';

import Link from 'next/link';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { FormField } from '@/components/ui/FormField';
import { SignupFormState } from '../../hooks/useSignupForm';

interface CustomerStep3Props {
  formState: SignupFormState;
  updateField: <K extends keyof SignupFormState>(field: K, value: SignupFormState[K]) => void;
}

export function CustomerStep3({ formState, updateField }: CustomerStep3Props) {
  return (
    <div className="space-y-6 flex-1">
      <FormField label="Phone" required>
        <Input
          id="phone"
          type="tel"
          value={formState.phone}
          onChange={(e) => updateField('phone', e.target.value)}
          onClear={() => updateField('phone', '')}
          showClear
          required
          placeholder="Enter your phone number"
          disabled={formState.isLoading}
        />
      </FormField>

      <FormField label="Email" required>
        <Input
          id="signup-email"
          type="email"
          value={formState.email}
          onChange={(e) => updateField('email', e.target.value)}
          onClear={() => updateField('email', '')}
          showClear
          required
          placeholder="Enter your email"
          disabled={formState.isLoading}
        />
      </FormField>

      <PasswordInput
        id="signup-password"
        label="Password"
        value={formState.password}
        onChange={(e) => updateField('password', e.target.value)}
        required
        placeholder="password"
        disabled={formState.isLoading}
      />

      <PasswordInput
        id="confirm-password"
        label="Repeat Password"
        value={formState.confirmPassword}
        onChange={(e) => updateField('confirmPassword', e.target.value)}
        required
        placeholder="repeat password"
        disabled={formState.isLoading}
      />

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
            I agree to the{' '}
            <Link href="/terms" className="underline hover:text-black">
              Terms of Service
            </Link>
            {' '}and{' '}
            <Link href="/privacy" className="underline hover:text-black">
              Privacy Policy
            </Link>
          </span>
        </label>
      </div>
    </div>
  );
}

