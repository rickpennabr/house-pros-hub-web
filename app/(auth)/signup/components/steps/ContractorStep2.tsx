'use client';

import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { FormField } from '@/components/ui/FormField';
import { SignupFormState } from '../../hooks/useSignupForm';
import { RESIDENTIAL_CONTRACTOR_LICENSES } from '@/lib/constants/contractorLicenses';

interface ContractorStep2Props {
  formState: SignupFormState;
  updateField: <K extends keyof SignupFormState>(field: K, value: SignupFormState[K]) => void;
}

export function ContractorStep2({ formState, updateField }: ContractorStep2Props) {
  const handleLicenseChange = (index: number, field: 'license' | 'trade', value: string) => {
    const newLicenses = [...formState.licenses];
    newLicenses[index] = { ...newLicenses[index], [field]: value };
    updateField('licenses', newLicenses);
  };

  const addLicense = () => {
    updateField('licenses', [...formState.licenses, { license: '', trade: '' }]);
  };

  const removeLicense = (index: number) => {
    if (formState.licenses.length > 1) {
      const newLicenses = formState.licenses.filter((_, i) => i !== index);
      updateField('licenses', newLicenses);
    }
  };

  return (
    <div className="space-y-6 flex-1">
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
        label="Confirm Password"
        value={formState.confirmPassword}
        onChange={(e) => updateField('confirmPassword', e.target.value)}
        required
        placeholder="confirm password"
        disabled={formState.isLoading}
      />

      <FormField label="Company Name" required>
        <Input
          id="companyName"
          type="text"
          value={formState.companyName}
          onChange={(e) => updateField('companyName', e.target.value)}
          onClear={() => updateField('companyName', '')}
          showClear
          required
          placeholder="Company name"
          disabled={formState.isLoading}
        />
      </FormField>

      <FormField label="Company Role">
        <Input
          id="companyRole"
          type="text"
          value={formState.companyRole}
          onChange={(e) => updateField('companyRole', e.target.value)}
          onClear={() => updateField('companyRole', '')}
          showClear
          placeholder="Your role in the company"
          disabled={formState.isLoading}
        />
      </FormField>

      {/* License Selection */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contractor License(s) <span className="text-red-500">*</span>
            </label>
            <span className="text-xs text-gray-500">Select all licenses you hold</span>
          </div>
          <button
            type="button"
            onClick={addLicense}
            className="px-3 py-1.5 text-sm border-2 border-black rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={formState.isLoading}
          >
            + Add License
          </button>
        </div>

        {formState.licenses.map((licenseItem, index) => (
          <div key={index} className="border-2 border-gray-300 rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 space-y-3">
                <FormField label={`License Classification ${index + 1}`} required>
                  <select
                    value={licenseItem.license}
                    onChange={(e) => {
                      handleLicenseChange(index, 'license', e.target.value);
                      // Clear license number when classification changes
                      if (e.target.value) {
                        handleLicenseChange(index, 'trade', '');
                      }
                    }}
                    required
                    className="w-full px-2 py-3 border-2 border-black rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={formState.isLoading}
                  >
                    <option value="">Select a license classification</option>
                    {RESIDENTIAL_CONTRACTOR_LICENSES.map((license) => (
                      <option key={license.code} value={license.code}>
                        {license.code} - {license.name}
                      </option>
                    ))}
                  </select>
                </FormField>

                {licenseItem.license && (
                  <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded border border-gray-200">
                    <p className="font-medium text-gray-700 mb-1">Description:</p>
                    {RESIDENTIAL_CONTRACTOR_LICENSES.find(l => l.code === licenseItem.license)?.description}
                  </div>
                )}

                <FormField label="License Number" required>
                  <Input
                    type="text"
                    value={licenseItem.trade || ''}
                    onChange={(e) => handleLicenseChange(index, 'trade', e.target.value)}
                    placeholder="Enter your license number"
                    disabled={formState.isLoading}
                    required
                  />
                </FormField>
              </div>

              {formState.licenses.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeLicense(index)}
                  className="px-2 py-1 text-sm text-red-600 hover:text-red-800 border border-red-300 rounded hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-8"
                  disabled={formState.isLoading}
                  aria-label={`Remove license ${index + 1}`}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

