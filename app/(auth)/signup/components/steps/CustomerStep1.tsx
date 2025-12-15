'use client';

import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { SignupFormState } from '../../hooks/useSignupForm';

interface CustomerStep1Props {
  formState: SignupFormState;
  updateField: <K extends keyof SignupFormState>(field: K, value: SignupFormState[K]) => void;
}

export function CustomerStep1({ formState, updateField }: CustomerStep1Props) {
  return (
    <div className="space-y-6 flex-1">
      <FormField label="How did you hear about us?" required>
        <select
          id="referral"
          value={formState.referral}
          onChange={(e) => {
            updateField('referral', e.target.value);
            if (e.target.value !== 'Other') {
              updateField('referralOther', '');
            }
          }}
          required
          className="w-full px-2 py-3 border-2 border-black rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 transition-all"
          disabled={formState.isLoading}
        >
          <option value="">Select an option</option>
          <option value="Google">Google</option>
          <option value="Instagram">Instagram</option>
          <option value="Facebook">Facebook</option>
          <option value="Other">Other</option>
        </select>
      </FormField>

      {formState.referral === 'Other' && (
        <FormField label="Please specify" required>
          <Input
            id="referralOther"
            type="text"
            value={formState.referralOther}
            onChange={(e) => updateField('referralOther', e.target.value)}
            onClear={() => updateField('referralOther', '')}
            showClear
            required
            placeholder="How did you hear about us?"
            disabled={formState.isLoading}
          />
        </FormField>
      )}

      <FormField label="First Name" required>
        <Input
          id="firstName"
          type="text"
          value={formState.firstName}
          onChange={(e) => updateField('firstName', e.target.value)}
          onClear={() => updateField('firstName', '')}
          showClear
          required
          placeholder="First name"
          disabled={formState.isLoading}
        />
      </FormField>

      <FormField label="Last Name" required>
        <Input
          id="lastName"
          type="text"
          value={formState.lastName}
          onChange={(e) => updateField('lastName', e.target.value)}
          onClear={() => updateField('lastName', '')}
          showClear
          required
          placeholder="Last name"
          disabled={formState.isLoading}
        />
      </FormField>
    </div>
  );
}

