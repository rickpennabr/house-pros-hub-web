'use client';

import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { SignupFormState } from '../../hooks/useSignupForm';

interface ContractorStep3Props {
  formState: SignupFormState;
  updateField: <K extends keyof SignupFormState>(field: K, value: SignupFormState[K]) => void;
  fieldErrors?: { [key: string]: string | undefined };
}

export function ContractorStep3({ formState, updateField, fieldErrors = {} }: ContractorStep3Props) {
  return (
    <div className="space-y-6 flex-1">
      <FormField label="Location Phone">
        <Input
          id="locationPhone"
          type="tel"
          value={formState.locationPhone}
          onChange={(e) => updateField('locationPhone', e.target.value)}
          onClear={() => updateField('locationPhone', '')}
          showClear
          placeholder="Location phone number"
          disabled={formState.isLoading}
        />
      </FormField>

      <FormField label="Mobile Phone">
        <Input
          id="mobilePhone"
          type="tel"
          value={formState.mobilePhone}
          onChange={(e) => updateField('mobilePhone', e.target.value)}
          onClear={() => updateField('mobilePhone', '')}
          showClear
          placeholder="Mobile phone number"
          disabled={formState.isLoading}
        />
      </FormField>
    </div>
  );
}

