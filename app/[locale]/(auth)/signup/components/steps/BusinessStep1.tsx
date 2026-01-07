'use client';

import { useRef, useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { Building2, Check, X } from 'lucide-react';
import type { BusinessFormValues } from '@/lib/schemas/business';
import { resizeImage, validateFileSize } from '@/lib/utils/image';
import { generateSlug } from '@/lib/utils/businessTransform';

export function BusinessStep1() {
  const t = useTranslations('businessForm.brand');
  const { register, setValue, watch, setError, clearErrors, formState: { errors, isSubmitting } } = useFormContext<BusinessFormValues>();
  
  const businessLogo = watch('businessLogo');
  const businessBackground = watch('businessBackground');
  const businessName = watch('businessName');
  const slug = watch('slug');
  const logoPreview = businessLogo || null;
  const bgPreview = businessBackground || null;
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);

  // Auto-suggestion logic for slug
  useEffect(() => {
    if (businessName && !isSlugManuallyEdited) {
      const suggestedSlug = generateSlug(businessName);
      setValue('slug', suggestedSlug, { shouldValidate: true });
    }
  }, [businessName, isSlugManuallyEdited, setValue]);

  // Uniqueness validation for slug - check database via API
  useEffect(() => {
    if (!slug || slug.length < 3) {
      // Clear error if slug is too short
      if (errors.slug?.type === 'manual') {
        clearErrors('slug');
      }
      return;
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(slug)) {
      // Format validation is handled by schema, don't set manual error here
      return;
    }

    // Debounce API call
    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch(`/api/business/check-slug?slug=${encodeURIComponent(slug)}`, {
          credentials: 'include',
        });

        if (!response.ok) {
          // If API call fails, don't block the user - let server-side validation handle it
          console.warn('Failed to check slug availability:', response.status);
          return;
        }

        const data = await response.json();
        
        if (!data.available) {
          setError('slug', { type: 'manual', message: t('userNameTaken') });
        } else {
          // Only clear if it was a manual uniqueness error
          if (errors.slug?.type === 'manual') {
            clearErrors('slug');
          }
        }
      } catch (error) {
        // If API call fails, don't block the user - let server-side validation handle it
        console.warn('Error checking slug availability:', error);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [slug, setError, clearErrors, errors.slug?.type, t]);

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert(t('imageTypeError'));
        if (logoInputRef.current) {
          logoInputRef.current.value = '';
        }
        return;
      }

      if (!validateFileSize(file, 2)) {
        alert(t('imageSizeError'));
        if (logoInputRef.current) {
          logoInputRef.current.value = '';
        }
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = async () => {
        const result = reader.result as string;
        try {
          // Resize image to 200px to save localStorage space
          const resized = await resizeImage(result, 200, 200, 0.7);
          setValue('businessLogo', resized);
        } catch (error) {
          console.error('Error resizing image:', error);
          setValue('businessLogo', result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBgChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert(t('imageTypeError'));
        if (bgInputRef.current) {
          bgInputRef.current.value = '';
        }
        return;
      }

      if (!validateFileSize(file, 2)) {
        alert(t('imageSizeError'));
        if (bgInputRef.current) {
          bgInputRef.current.value = '';
        }
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = async () => {
        const result = reader.result as string;
        try {
          // Resize background to 800px width (larger than logo)
          const resized = await resizeImage(result, 800, 400, 0.6);
          setValue('businessBackground', resized);
        } catch (error) {
          console.error('Error resizing background image:', error);
          setValue('businessBackground', result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6 flex-1">
      {/* Profile Preview Section (Logo & Background) */}
      <div className="space-y-2">
        <label className="block text-sm font-bold text-black uppercase tracking-wider">{t('sectionTitle')}</label>
        <div className="relative w-full h-[200px] md:h-[300px] lg:h-[350px] group">
          {/* Background Container with Overflow Hidden */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[95%] h-[95%] rounded-lg border-2 border-black bg-white overflow-hidden">
            {/* Background Image (if exists) */}
            {bgPreview && (
              <div className="absolute inset-0 w-full h-full pointer-events-none">
                <Image
                  src={bgPreview}
                  alt="Background preview"
                  fill
                  sizes="(max-width: 768px) 100vw, 800px"
                  className="object-cover object-center"
                  unoptimized
                />
              </div>
            )}
            
            {/* Background Upload/Click Area - Always covers full area */}
            <div 
              onClick={() => bgInputRef.current?.click()}
              className="absolute inset-0 w-full h-full cursor-pointer hover:bg-gray-50/30 transition-colors z-10"
            >
              {!bgPreview && (
                <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 gap-1">
                  <Building2 className="w-8 h-8 opacity-20" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">{t('clickUploadBackground')}</span>
                </div>
              )}
            </div>
            
            {/* Background Edit/Remove Controls */}
            {bgPreview && (
              <div className="absolute top-2 right-2 flex gap-2 z-20">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setValue('businessBackground', '');
                    if (bgInputRef.current) {
                      bgInputRef.current.value = '';
                    }
                  }}
                  className="p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-md cursor-pointer"
                  title={t('removeBackgroundTitle')}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Logo Upload/Preview (Overlapping Bottom Center) */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 z-10">
            <div 
              onClick={() => logoInputRef.current?.click()}
              className="w-24 h-24 rounded-lg border-4 border-white bg-white shadow-xl overflow-hidden flex items-center justify-center cursor-pointer group-hover:scale-105 transition-transform relative"
            >
              {logoPreview ? (
                <div className="relative w-full h-full pointer-events-none">
                  <Image
                    src={logoPreview}
                    alt="Logo preview"
                    fill
                    sizes="96px"
                    className="object-cover object-center"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="w-full h-full bg-black flex flex-col items-center justify-center text-white gap-1 p-2">
                  <Building2 className="w-6 h-6" />
                  <span className="text-[8px] font-bold uppercase text-center">{t('uploadLogo')}</span>
                </div>
              )}
            </div>
            {logoPreview && typeof logoPreview === 'string' && logoPreview.trim() !== '' && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setValue('businessLogo', '');
                  if (logoInputRef.current) {
                    logoInputRef.current.value = '';
                  }
                }}
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 border-2 border-white flex items-center justify-center cursor-pointer hover:bg-red-600 transition-colors shadow-lg z-20"
                title={t('removeLogoTitle')}
              >
                <X className="w-3 h-3 text-white" />
              </button>
            )}
          </div>
        </div>

        {/* Hidden File Inputs */}
        <input
          ref={logoInputRef}
          type="file"
          accept="image/*"
          onChange={handleLogoChange}
          className="hidden"
          disabled={isSubmitting}
        />
        <input
          ref={bgInputRef}
          type="file"
          accept="image/*"
          onChange={handleBgChange}
          className="hidden"
          disabled={isSubmitting}
        />
      </div>

      <div className="pt-4">
        {/* Business Name */}
        <FormField label={t('businessNameLabel')} required error={errors.businessName?.message}>
          <Input
            {...register('businessName')}
            id="businessName"
            type="text"
            value={businessName || ''}
            onClear={() => setValue('businessName', '')}
            showClear
            required
            placeholder={t('businessNamePlaceholder')}
            disabled={isSubmitting}
            error={errors.businessName?.message}
          />
        </FormField>
      </div>
      
      {/* User Name */}
      <FormField label={t('userNameLabel')} required error={errors.slug?.message}>
        <div className="space-y-2">
          <div className={`flex items-center border-2 rounded-lg overflow-hidden transition-all ${
            errors.slug 
              ? 'border-red-500 ring-2 ring-red-500 ring-offset-1' 
              : 'border-black focus-within:ring-2 focus-within:ring-black focus-within:ring-offset-1'
          }`}>
            <div className="bg-gray-100 px-1.5 py-2.5 text-gray-500 border-r-2 border-black flex items-center whitespace-nowrap text-[9px] sm:text-[11px] font-bold lowercase tracking-wider">
              houseproshub.com/business/
            </div>
            <div className="flex-1 relative bg-white">
              <input
                {...register('slug')}
                id="slug"
                type="text"
                value={slug || ''}
                onChange={(e) => {
                  setIsSlugManuallyEdited(true);
                  setValue('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'), { shouldValidate: true });
                }}
                className="w-full bg-transparent px-3 py-2.5 pr-9 focus:outline-none text-sm font-bold text-black"
                placeholder={t('userNamePlaceholder')}
                disabled={isSubmitting}
              />
              {slug && (
                <button
                  type="button"
                  onClick={() => {
                    setIsSlugManuallyEdited(false);
                    setValue('slug', '');
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full transition-colors text-gray-400 hover:text-black hover:bg-gray-100"
                  disabled={isSubmitting}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          
          {slug && slug.length >= 3 && !errors.slug && (
            <div className="flex items-center gap-1.5 text-green-600 text-sm px-1 font-medium animate-fade-in">
              <span className="flex items-center justify-center w-4 h-4 rounded-full bg-green-100 border border-green-200">
                <Check className="w-3 h-3" />
              </span>
              <span>{t('userNameAvailable')}</span>
            </div>
          )}
          
          {!errors.slug && (!slug || slug.length < 3) && (
            <p className="text-xs text-gray-500 px-1">
              {t('userNameMinHelp')}
            </p>
          )}
        </div>
      </FormField>

      {/* Business Description */}
      <FormField label={t('descriptionLabel')} error={errors.companyDescription?.message}>
        <textarea
          {...register('companyDescription')}
          id="companyDescription"
          rows={4}
          className={`w-full px-4 py-2 border-2 border-black rounded-lg focus:outline-none resize-none transition-all ${
            errors.companyDescription ? 'border-red-500 focus:border-red-500' : ''
          }`}
          placeholder={t('descriptionPlaceholder')}
          disabled={isSubmitting}
        />
      </FormField>
    </div>
  );
}
