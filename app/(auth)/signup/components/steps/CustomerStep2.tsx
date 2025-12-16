'use client';

import AddressAutocomplete, { AddressData } from '@/components/AddressAutocomplete';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { SignupFormState } from '../../hooks/useSignupForm';

interface CustomerStep2Props {
  formState: SignupFormState;
  updateField: <K extends keyof SignupFormState>(field: K, value: SignupFormState[K]) => void;
  onAddressSelect: (addressData: AddressData) => void;
  onAddressChange: (value: string) => void;
  fieldErrors?: { [key: string]: string | undefined };
}

export function CustomerStep2({
  formState,
  updateField,
  onAddressSelect,
  onAddressChange,
  fieldErrors = {},
}: CustomerStep2Props) {
  return (
    <div className="space-y-6 flex-1">
      <FormField label="Search Address (Nevada only)" required error={fieldErrors.streetAddress}>
        <p className="text-xs text-gray-600 mb-2">
          Search for your address or fill in the fields below manually
        </p>
        <AddressAutocomplete
          id="address"
          value={formState.address}
          onChange={onAddressChange}
          onAddressSelect={onAddressSelect}
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
        <FormField label="City" required error={fieldErrors.city}>
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
            error={fieldErrors.city}
          />
        </FormField>

        <FormField label="State" required error={fieldErrors.state}>
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
            error={fieldErrors.state}
          />
        </FormField>
      </div>

      <FormField label="ZIP Code" required error={fieldErrors.zipCode}>
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
          error={fieldErrors.zipCode}
        />
      </FormField>

      <FormField label="Gate Code">
        <Input
          id="gateCode"
          type="text"
          value={formState.gateCode}
          onChange={(e) => updateField('gateCode', e.target.value)}
          onClear={() => updateField('gateCode', '')}
          showClear
          placeholder="Gate code"
          disabled={formState.isLoading}
        />
      </FormField>

      <FormField label="Address Note">
        <div className="relative">
          <textarea
            id="addressNote"
            value={formState.addressNote}
            onChange={(e) => updateField('addressNote', e.target.value)}
            rows={3}
            className="w-full px-2 py-3 pr-8 border-2 border-black rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 transition-all resize-none"
            placeholder="Additional address notes or instructions"
            disabled={formState.isLoading}
          />
          {formState.addressNote && (
            <button
              type="button"
              onClick={() => updateField('addressNote', '')}
              className="absolute right-2 top-2 text-gray-600 hover:text-black transition-colors cursor-pointer"
              disabled={formState.isLoading}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                className="w-4 h-4"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </FormField>
    </div>
  );
}

