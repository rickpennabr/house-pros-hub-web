'use client';

import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { BusinessFormState } from '../../hooks/useAddBusinessForm';
import { RESIDENTIAL_CONTRACTOR_LICENSES } from '@/lib/constants/contractorLicenses';

interface BusinessStep1Props {
  formState: BusinessFormState;
  updateField: <K extends keyof BusinessFormState>(
    field: K,
    value: BusinessFormState[K]
  ) => void;
  handleLicenseChange: (
    index: number,
    field: 'license' | 'trade' | 'licenseNumber',
    value: string
  ) => void;
  addLicense: () => void;
  removeLicense: (index: number) => void;
}

export function BusinessStep1({
  formState,
  updateField,
  handleLicenseChange,
  addLicense,
  removeLicense,
}: BusinessStep1Props) {
  return (
    <div className="space-y-6 flex-1">
      {/* Business Name */}
      <FormField label="Business Name" required>
        <Input
          id="businessName"
          type="text"
          value={formState.businessName}
          onChange={(e) => updateField('businessName', e.target.value)}
          onClear={() => updateField('businessName', '')}
          showClear
          required
          placeholder="Enter your business name"
          disabled={formState.isLoading}
        />
      </FormField>

      {/* Licenses Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contractor License(s) <span className="text-red-500">*</span>
            </label>
            <span className="text-xs text-gray-500">
              Select all licenses you hold
            </span>
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

        {formState.licenses.map((licenseItem, index) => {
          const selectedLicense = RESIDENTIAL_CONTRACTOR_LICENSES.find(
            l => l.code === licenseItem.license
          );
          const isGeneralContractor = licenseItem.license === 'GENERAL';

          return (
            <div
              key={index}
              className="border-2 border-gray-300 rounded-lg p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 space-y-3">
                  <FormField
                    label={`${index + 1}`}
                    required
                  >
                    <select
                      key={`license-select-${index}`}
                      value={licenseItem.license || ''}
                      onChange={(e) => {
                        const selectedValue = e.target.value;
                        handleLicenseChange(index, 'license', selectedValue);
                        // Auto-populate trade when license is selected
                        if (selectedValue === 'GENERAL') {
                          handleLicenseChange(
                            index,
                            'trade',
                            'General Contractor'
                          );
                        } else if (selectedValue) {
                          const license = RESIDENTIAL_CONTRACTOR_LICENSES.find(
                            l => l.code === selectedValue
                          );
                          if (license) {
                            handleLicenseChange(index, 'trade', license.name);
                          }
                        } else {
                          handleLicenseChange(index, 'trade', '');
                        }
                      }}
                      required
                      className="w-full px-2 py-3 border-2 border-black rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={formState.isLoading}
                    >
                      <option value="">Select a license classification</option>
                      <option value="GENERAL">General Contractor License</option>
                      {RESIDENTIAL_CONTRACTOR_LICENSES.map((license) => (
                        <option key={license.code} value={license.code}>
                          {license.code} - {license.name}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  {licenseItem.license && !isGeneralContractor && (
                    <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded border border-gray-200">
                      <p className="font-medium text-gray-700 mb-1">
                        Description:
                      </p>
                      {selectedLicense?.description}
                    </div>
                  )}

                  <FormField label="Trade" required>
                    <Input
                      type="text"
                      value={licenseItem.trade}
                      onChange={(e) =>
                        handleLicenseChange(index, 'trade', e.target.value)
                      }
                      placeholder={
                        isGeneralContractor
                          ? 'General Contractor'
                          : 'Trade name'
                      }
                      disabled={formState.isLoading}
                      required
                    />
                  </FormField>

                  <FormField label="License Number" required>
                    <Input
                      type="text"
                      value={licenseItem.licenseNumber}
                      onChange={(e) =>
                        handleLicenseChange(
                          index,
                          'licenseNumber',
                          e.target.value
                        )
                      }
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
          );
        })}
      </div>
    </div>
  );
}

