'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { BusinessFormState } from '../../hooks/useAddBusinessForm';
import { AddressData } from '@/components/AddressAutocomplete';

interface BusinessStep2Props {
  formState: BusinessFormState;
  updateField: <K extends keyof BusinessFormState>(
    field: K,
    value: BusinessFormState[K]
  ) => void;
  handleAddressSelect: (addressData: AddressData) => void;
  handleAddressChange: (value: string) => void;
  usePersonalAddress: () => void;
  personalData?: {
    address?: string;
    streetAddress?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    apartment?: string;
  };
  fieldErrors?: { [key: string]: string | undefined };
}

export function BusinessStep2({
  formState,
  updateField,
  handleAddressSelect,
  handleAddressChange,
  usePersonalAddress,
  personalData,
}: BusinessStep2Props) {
  const [usePersonalAddressChecked, setUsePersonalAddressChecked] = useState(false);

  const handleCheckboxChange = (checked: boolean) => {
    setUsePersonalAddressChecked(checked);
    if (checked) {
      usePersonalAddress();
    }
  };

  return (
    <div className="space-y-6 flex-1">
      <FormField label="Business Address" required>
        {personalData && (personalData?.streetAddress || personalData?.address) && (
          <div className="flex items-center justify-start mb-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs text-gray-700">Same as Personal</span>
              <input
                type="checkbox"
                checked={usePersonalAddressChecked}
                onChange={(e) => handleCheckboxChange(e.target.checked)}
                disabled={formState.isLoading}
                className="w-4 h-4 border-2 border-black rounded accent-black focus:ring-2 focus:ring-black focus:ring-offset-2"
              />
            </label>
          </div>
        )}
        <AddressAutocomplete
          id="business-address"
          value={formState.address}
          onChange={handleAddressChange}
          onAddressSelect={handleAddressSelect}
          placeholder="Search for your Nevada address"
          disabled={formState.isLoading}
        />
      </FormField>

      <input type="hidden" value={formState.streetAddress} required />

      <FormField label="Apartment, Suite, Unit (Optional)">
        <Input
          id="apartment"
          type="text"
          value={formState.apartment}
          onChange={(e) => updateField('apartment', e.target.value)}
          onClear={() => updateField('apartment', '')}
          showClear
          placeholder="Apt, Suite, Unit, etc."
          disabled={formState.isLoading}
        />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="City" required>
          <Input
            id="city"
            type="text"
            value={formState.city}
            onChange={(e) => updateField('city', e.target.value)}
            onClear={() => updateField('city', '')}
            showClear
            required
            placeholder="City"
            disabled={formState.isLoading}
          />
        </FormField>

        <FormField label="State" required>
          <Input
            id="state"
            type="text"
            value={formState.state}
            onChange={(e) => updateField('state', e.target.value)}
            onClear={() => updateField('state', 'NV')}
            showClear
            required
            placeholder="State"
            disabled={formState.isLoading}
          />
        </FormField>
      </div>

      <FormField label="ZIP Code" required>
        <Input
          id="zipCode"
          type="text"
          value={formState.zipCode}
          onChange={(e) => updateField('zipCode', e.target.value)}
          onClear={() => updateField('zipCode', '')}
          showClear
          required
          placeholder="ZIP Code"
          disabled={formState.isLoading}
        />
      </FormField>
    </div>
  );
}

