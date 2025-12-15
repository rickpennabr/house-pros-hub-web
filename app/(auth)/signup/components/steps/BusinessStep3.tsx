'use client';

import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { Button } from '@/components/ui/Button';
import { BusinessFormState } from '../../hooks/useAddBusinessForm';

interface BusinessStep3Props {
  formState: BusinessFormState;
  updateField: <K extends keyof BusinessFormState>(
    field: K,
    value: BusinessFormState[K]
  ) => void;
  usePersonalEmail: () => void;
  usePersonalPhone: () => void;
  personalData?: {
    email?: string;
    phone?: string;
  };
}

export function BusinessStep3({
  formState,
  updateField,
  usePersonalEmail,
  usePersonalPhone,
  personalData,
}: BusinessStep3Props) {
  return (
    <div className="space-y-6 flex-1">
      <FormField label="Business Email">
        <div className="flex gap-2">
          <Input
            id="business-email"
            type="email"
            value={formState.email}
            onChange={(e) => updateField('email', e.target.value)}
            onClear={() => updateField('email', '')}
            showClear
            placeholder="Enter business email"
            disabled={formState.isLoading}
            className="flex-1"
          />
          {personalData?.email && (
            <Button
              type="button"
              variant="secondary"
              onClick={usePersonalEmail}
              disabled={formState.isLoading}
              className="whitespace-nowrap"
            >
              Use Personal
            </Button>
          )}
        </div>
      </FormField>

      <FormField label="Business Phone">
        <div className="flex gap-2">
          <Input
            id="business-phone"
            type="tel"
            value={formState.phone}
            onChange={(e) => updateField('phone', e.target.value)}
            onClear={() => updateField('phone', '')}
            showClear
            placeholder="Enter business phone"
            disabled={formState.isLoading}
            className="flex-1"
          />
          {personalData?.phone && (
            <Button
              type="button"
              variant="secondary"
              onClick={usePersonalPhone}
              disabled={formState.isLoading}
              className="whitespace-nowrap"
            >
              Use Personal
            </Button>
          )}
        </div>
      </FormField>
    </div>
  );
}

