'use client';

import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { Button } from '@/components/ui/Button';
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
    streetAddress?: string;
  };
}

export function BusinessStep2({
  formState,
  updateField,
  handleAddressSelect,
  handleAddressChange,
  usePersonalAddress,
  personalData,
}: BusinessStep2Props) {
  return (
    <div className="space-y-6 flex-1">
      <FormField label="Business Address" required>
        <p className="text-xs text-gray-600 mb-2">
          Search for your address or fill in the fields below manually
        </p>
        <div className="flex gap-2">
          <div className="flex-1">
            <AddressAutocomplete
              id="business-address"
              value={formState.address}
              onChange={handleAddressChange}
              onAddressSelect={handleAddressSelect}
              placeholder="Search for your Nevada address"
              disabled={formState.isLoading}
            />
          </div>
          {personalData?.streetAddress && (
            <Button
              type="button"
              variant="secondary"
              onClick={usePersonalAddress}
              disabled={formState.isLoading}
              className="whitespace-nowrap"
            >
              Use Personal
            </Button>
          )}
        </div>
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

