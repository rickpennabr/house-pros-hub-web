'use client';

import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { BusinessFormState } from '../../hooks/useAddBusinessForm';
import { RESIDENTIAL_CONTRACTOR_LICENSES } from '@/lib/constants/contractorLicenses';
import { Building2 } from 'lucide-react';

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
  fieldErrors?: { [key: string]: string | undefined };
}

export function BusinessStep1({
  formState,
  updateField,
  handleLicenseChange,
  addLicense,
  removeLicense,
  fieldErrors = {},
}: BusinessStep1Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(formState.businessLogo || null);

  // Sync preview with formState when it changes
  useEffect(() => {
    setPreview(formState.businessLogo || null);
  }, [formState.businessLogo]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      
      // Create preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setPreview(result);
        updateField('businessLogo', result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-6 flex-1">
      {/* Business Logo Upload */}
      <div className="flex flex-col items-center gap-2">
        <div
          onClick={handleClick}
          className="w-24 h-24 rounded-lg border-2 border-black flex items-center justify-center bg-white cursor-pointer hover:bg-gray-50 transition-colors overflow-hidden"
        >
          {preview ? (
            <img
              src={preview}
              alt="Business logo"
              className="w-full h-full object-cover"
            />
          ) : (
            <Building2 className="w-10 h-10 text-black" />
          )}
        </div>
        <span className="text-sm font-medium text-black">Upload Business Logo</span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
          disabled={formState.isLoading}
        />
      </div>

      {/* Business Name */}
      <FormField label="Business Name" required error={fieldErrors.businessName}>
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
          error={fieldErrors.businessName}
        />
      </FormField>

      {/* Licenses Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <label className={`block text-sm font-medium mb-1 ${fieldErrors.licenses ? 'text-red-600' : 'text-gray-700'}`}>
              Contractor License(s) {!fieldErrors.licenses && <span className="text-red-500">*</span>}
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
        {fieldErrors.licenses && (
          <p className="text-sm text-red-600">{fieldErrors.licenses}</p>
        )}

        {formState.licenses.map((licenseItem, index) => {
          return (
            <div
              key={index}
              className="border-2 border-gray-300 rounded-lg p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 space-y-3">
                  <FormField
                    label={`License Classification ${index + 1}`}
                    required
                    error={fieldErrors[`license_${index}_license`]}
                  >
                    <select
                      key={`license-select-${index}`}
                      value={licenseItem.license || ''}
                      onChange={(e) => {
                        const selectedValue = e.target.value;
                        // Auto-populate both license and trade when selection is made
                        if (selectedValue === 'GENERAL') {
                          handleLicenseChange(index, 'license', selectedValue);
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
                            handleLicenseChange(index, 'license', selectedValue);
                            handleLicenseChange(index, 'trade', license.name);
                          }
                        } else {
                          handleLicenseChange(index, 'license', '');
                          handleLicenseChange(index, 'trade', '');
                        }
                      }}
                      required
                      className={`w-full px-2 py-3 border-2 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        fieldErrors[`license_${index}_license`]
                          ? 'border-red-500 focus:ring-red-500'
                          : 'border-black focus:ring-black'
                      }`}
                      disabled={formState.isLoading}
                    >
                      <option value="">Select a license classification</option>
                      <option value="GENERAL">GENERAL - General Contractor License</option>
                      {RESIDENTIAL_CONTRACTOR_LICENSES.map((license) => (
                        <option key={license.code} value={license.code}>
                          {license.code} - {license.name}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <FormField 
                    label="License Number" 
                    required
                    error={fieldErrors[`license_${index}_licenseNumber`]}
                  >
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
                      error={fieldErrors[`license_${index}_licenseNumber`]}
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

