'use client';

import { useState, useRef } from 'react';
import { useFormContext } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { Select } from '@/components/ui/Select';
import { User, X } from 'lucide-react';
import { SignupSchema } from '@/lib/schemas/auth';
import { resizeImage, resizeImageSquare, validateFileSize } from '@/lib/utils/image';

export function ContractorStep1() {
  const tFields = useTranslations('auth.signup.fields');
  const { register, setValue, watch, formState: { errors, isSubmitting } } = useFormContext<SignupSchema>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const userPicture = watch('userPicture');
  const referral = watch('referral');
  const referralOther = watch('referralOther');
  const firstName = watch('firstName');
  const lastName = watch('lastName');
  const [preview, setPreview] = useState<string | null>(userPicture || null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert(tFields('imageTypeError'));
        return;
      }

      if (!validateFileSize(file, 5)) {
        alert(tFields('imageSizeError'));
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = async () => {
        const result = reader.result as string;
        try {
          // Use square crop for profile pictures with better quality
          const resized = await resizeImageSquare(result, 400, 0.85);
          setPreview(resized);
          setValue('userPicture', resized);
        } catch (error) {
          console.error('Error resizing image:', error);
          // Fallback to regular resize if square crop fails
          try {
            const fallbackResized = await resizeImage(result, 400, 400, 0.85);
            setPreview(fallbackResized);
            setValue('userPicture', fallbackResized);
          } catch (fallbackError) {
            console.error('Error with fallback resize:', fallbackError);
            setPreview(result);
            setValue('userPicture', result);
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemovePicture = () => {
    setPreview(null);
    setValue('userPicture', '');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6 flex-1 animate-fade-in">
      {/* User Picture Upload */}
      <div className="flex flex-col items-center gap-2 pt-2">
        <div className="relative">
          <div
            onClick={handleClick}
            className="w-24 h-24 rounded-lg border-2 border-black flex items-center justify-center bg-white cursor-pointer hover:bg-gray-50 transition-colors overflow-hidden relative aspect-square"
          >
            {preview ? (
              <Image
                src={preview}
                alt="User picture"
                fill
                className="object-cover"
                sizes="96px"
                unoptimized
              />
            ) : (
              <User className="w-10 h-10 text-black" />
            )}
          </div>
          {preview && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRemovePicture();
              }}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 border-2 border-white flex items-center justify-center cursor-pointer hover:bg-red-600 transition-colors shadow-lg z-10"
              aria-label={tFields('removeProfilePicture')}
            >
              <X className="w-3 h-3 text-white" />
            </button>
          )}
        </div>
        <span className="text-sm font-medium text-black">{tFields('uploadPicture')}</span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
          disabled={isSubmitting}
        />
      </div>

      <FormField label={tFields('referralLabel')} required error={errors.referral?.message}>
        <Select
          {...register('referral')}
          id="referral"
          required
          disabled={isSubmitting}
          error={errors.referral?.message}
        >
          <option value="">{tFields('referralSelectPlaceholder')}</option>
          <option value="Google">Google</option>
          <option value="Instagram">Instagram</option>
          <option value="Facebook">Facebook</option>
          <option value="Other">{tFields('referralOtherOption')}</option>
        </Select>
      </FormField>

      {referral === 'Other' && (
        <FormField label={tFields('referralOtherLabel')} required error={errors.referralOther?.message}>
          <Input
            {...register('referralOther')}
            id="referralOther"
            type="text"
            value={referralOther || ''}
            onClear={() => setValue('referralOther', '')}
            showClear
            required
            placeholder={tFields('referralOtherPlaceholder')}
            disabled={isSubmitting}
            error={errors.referralOther?.message}
          />
        </FormField>
      )}

      <FormField label={tFields('firstNameLabel')} required error={errors.firstName?.message}>
        <Input
          {...register('firstName')}
          id="firstName"
          type="text"
          value={firstName || ''}
          onClear={() => setValue('firstName', '')}
          showClear
          required
          placeholder={tFields('firstNamePlaceholder')}
          disabled={isSubmitting}
          error={errors.firstName?.message}
        />
      </FormField>

      <FormField label={tFields('lastNameLabel')} required error={errors.lastName?.message}>
        <Input
          {...register('lastName')}
          id="lastName"
          type="text"
          value={lastName || ''}
          onClear={() => setValue('lastName', '')}
          showClear
          required
          placeholder={tFields('lastNamePlaceholder')}
          disabled={isSubmitting}
          error={errors.lastName?.message}
        />
      </FormField>
    </div>
  );
}

