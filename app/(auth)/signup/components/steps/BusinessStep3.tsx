'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { BusinessFormState } from '../../hooks/useAddBusinessForm';

interface BusinessStep3Props {
  formState: BusinessFormState;
  updateField: <K extends keyof BusinessFormState>(
    field: K,
    value: BusinessFormState[K]
  ) => void;
  usePersonalEmail: () => void;
  usePersonalPhone: () => void;
  usePersonalMobilePhone: () => void;
  personalData?: {
    email?: string;
    phone?: string;
    mobilePhone?: string;
  };
  fieldErrors?: { [key: string]: string | undefined };
}

export function BusinessStep3({
  formState,
  updateField,
  usePersonalEmail,
  usePersonalPhone,
  usePersonalMobilePhone,
  personalData,
}: BusinessStep3Props) {
  const [usePersonalEmailChecked, setUsePersonalEmailChecked] = useState(false);
  const [usePersonalPhoneChecked, setUsePersonalPhoneChecked] = useState(false);
  const [usePersonalMobilePhoneChecked, setUsePersonalMobilePhoneChecked] = useState(false);

  const handleEmailCheckboxChange = (checked: boolean) => {
    setUsePersonalEmailChecked(checked);
    if (checked) {
      usePersonalEmail();
    }
  };

  const handlePhoneCheckboxChange = (checked: boolean) => {
    setUsePersonalPhoneChecked(checked);
    if (checked) {
      usePersonalPhone();
    }
  };

  const handleMobilePhoneCheckboxChange = (checked: boolean) => {
    setUsePersonalMobilePhoneChecked(checked);
    if (checked) {
      usePersonalMobilePhone();
    }
  };

  return (
    <div className="space-y-6 flex-1">
      <FormField label="Business Email">
        {personalData?.email && (
          <div className="flex items-center justify-start mb-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs text-gray-700">Same as Personal</span>
              <input
                type="checkbox"
                checked={usePersonalEmailChecked}
                onChange={(e) => handleEmailCheckboxChange(e.target.checked)}
                disabled={formState.isLoading}
                className="w-4 h-4 border-2 border-black rounded accent-black focus:ring-2 focus:ring-black focus:ring-offset-2"
              />
            </label>
          </div>
        )}
        <Input
          id="business-email"
          type="email"
          value={formState.email}
          onChange={(e) => updateField('email', e.target.value)}
          onClear={() => updateField('email', '')}
          showClear
          placeholder="Enter business email"
          disabled={formState.isLoading}
        />
      </FormField>

      <FormField label="Land Phone">
        {personalData?.phone && (
          <div className="flex items-center justify-start mb-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs text-gray-700">Same as Personal</span>
              <input
                type="checkbox"
                checked={usePersonalPhoneChecked}
                onChange={(e) => handlePhoneCheckboxChange(e.target.checked)}
                disabled={formState.isLoading}
                className="w-4 h-4 border-2 border-black rounded accent-black focus:ring-2 focus:ring-black focus:ring-offset-2"
              />
            </label>
          </div>
        )}
        <Input
          id="land-phone"
          type="tel"
          value={formState.phone}
          onChange={(e) => updateField('phone', e.target.value)}
          onClear={() => updateField('phone', '')}
          showClear
          placeholder="Enter land phone"
          disabled={formState.isLoading}
        />
      </FormField>

      <FormField label="Mobile Phone">
        {(personalData?.mobilePhone || personalData?.phone) && (
          <div className="flex items-center justify-start mb-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs text-gray-700">Same as Personal</span>
              <input
                type="checkbox"
                checked={usePersonalMobilePhoneChecked}
                onChange={(e) => handleMobilePhoneCheckboxChange(e.target.checked)}
                disabled={formState.isLoading}
                className="w-4 h-4 border-2 border-black rounded accent-black focus:ring-2 focus:ring-black focus:ring-offset-2"
              />
            </label>
          </div>
        )}
        <Input
          id="mobile-phone"
          type="tel"
          value={formState.mobilePhone}
          onChange={(e) => updateField('mobilePhone', e.target.value)}
          onClear={() => updateField('mobilePhone', '')}
          showClear
          placeholder="Enter mobile phone"
          disabled={formState.isLoading}
        />
      </FormField>
    </div>
  );
}

