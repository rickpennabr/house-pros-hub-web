'use client';

import { useState, useRef } from 'react';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { Select } from '@/components/ui/Select';
import { SignupFormState } from '../../hooks/useSignupForm';
import { User } from 'lucide-react';

interface ContractorStep1Props {
  formState: SignupFormState;
  updateField: <K extends keyof SignupFormState>(field: K, value: SignupFormState[K]) => void;
  fieldErrors?: { [key: string]: string | undefined };
}

export function ContractorStep1({ formState, updateField, fieldErrors = {} }: ContractorStep1Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(formState.userPicture || null);

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
        updateField('userPicture', result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-6 flex-1">
      {/* User Picture Upload */}
      <div className="flex flex-col items-center gap-2">
        <div
          onClick={handleClick}
          className="w-24 h-24 rounded-lg border-2 border-black flex items-center justify-center bg-white cursor-pointer hover:bg-gray-50 transition-colors overflow-hidden"
        >
          {preview ? (
            <img
              src={preview}
              alt="User picture"
              className="w-full h-full object-cover"
            />
          ) : (
            <User className="w-10 h-10 text-black" />
          )}
        </div>
        <span className="text-sm font-medium text-black">Upload Your Picture</span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
          disabled={formState.isLoading}
        />
      </div>

      <FormField label="How did you hear about us?" required error={fieldErrors.referral}>
        <Select
          id="referral"
          value={formState.referral}
          onChange={(e) => {
            updateField('referral', e.target.value);
            if (e.target.value !== 'Other') {
              updateField('referralOther', '');
            }
          }}
          required
          disabled={formState.isLoading}
          error={fieldErrors.referral}
        >
          <option value="">Select an option</option>
          <option value="Google">Google</option>
          <option value="Instagram">Instagram</option>
          <option value="Facebook">Facebook</option>
          <option value="Other">Other</option>
        </Select>
      </FormField>

      {formState.referral === 'Other' && (
        <FormField label="Please specify" required error={fieldErrors.referralOther}>
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
            error={fieldErrors.referralOther}
          />
        </FormField>
      )}

      <FormField label="First Name" required error={fieldErrors.firstName}>
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
          error={fieldErrors.firstName}
        />
      </FormField>

      <FormField label="Last Name" required error={fieldErrors.lastName}>
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
          error={fieldErrors.lastName}
        />
      </FormField>
    </div>
  );
}

