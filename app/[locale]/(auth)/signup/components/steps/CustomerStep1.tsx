'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { Select } from '@/components/ui/Select';
import { TipModal } from '@/components/ui/TipModal';
import { ZoomSlider } from '@/components/ui/ZoomSlider';
import { VerticalSlider } from '@/components/ui/VerticalSlider';
import { HorizontalSlider } from '@/components/ui/HorizontalSlider';
import { User, X, Pencil, Check } from 'lucide-react';
import { SignupSchema } from '@/lib/schemas/auth';
import { resizeImage, resizeImageSquare, validateFileSize } from '@/lib/utils/image';
import { useTypingPlaceholder } from '@/hooks/useTypingPlaceholder';

export function CustomerStep1() {
  const tFields = useTranslations('auth.signup.fields');
  const { register, setValue, watch, formState: { errors, isSubmitting } } = useFormContext<SignupSchema>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const userPicture = watch('userPicture');
  const referral = watch('referral');
  const referralOther = watch('referralOther');
  const firstName = watch('firstName');
  const lastName = watch('lastName');

  // Typing animation for placeholders
  const firstNamePlaceholder = tFields('firstNamePlaceholder');
  const lastNamePlaceholder = tFields('lastNamePlaceholder');
  const placeholders = useMemo(
    () => [firstNamePlaceholder, lastNamePlaceholder],
    [firstNamePlaceholder, lastNamePlaceholder]
  );
  const animatedPlaceholders = useTypingPlaceholder({
    placeholders,
    typingSpeed: 100,
    delayBetweenFields: 300,
    startDelay: 500,
  });
  const [preview, setPreview] = useState<string | null>(userPicture || null);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [zoom, setZoom] = useState(50);
  const [verticalPosition, setVerticalPosition] = useState(50);
  const [horizontalPosition, setHorizontalPosition] = useState(50);
  const [isEditMode, setIsEditMode] = useState(false);
  const zoomRef = useRef(50);
  const verticalPositionRef = useRef(50);
  const horizontalPositionRef = useRef(50);

  // Keep refs in sync with state
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    verticalPositionRef.current = verticalPosition;
  }, [verticalPosition]);

  useEffect(() => {
    horizontalPositionRef.current = horizontalPosition;
  }, [horizontalPosition]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert(tFields('imageTypeError'));
        return;
      }

      if (!validateFileSize(file, 2)) {
        alert(tFields('imageSizeError'));
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = async () => {
        const result = reader.result as string;
        // Store original image for zoom functionality (keep this as the source for all edits)
        setOriginalImage(result);
        const initialZoom = 50;
        const initialPosition = 50;
        setZoom(initialZoom); // Reset zoom to default
        setVerticalPosition(initialPosition); // Reset vertical position to center
        setHorizontalPosition(initialPosition); // Reset horizontal position to center
        zoomRef.current = initialZoom;
        verticalPositionRef.current = initialPosition;
        horizontalPositionRef.current = initialPosition;
        setIsEditMode(true); // Enter edit mode when new image is uploaded
        // Initially show the image without zoom applied
        await applyZoom(result, initialZoom, initialPosition, initialPosition);
      };
      reader.readAsDataURL(file);
    }
  };

  const applyZoom = async (imageSrc: string, zoomValue: number, vertPosition?: number, horzPosition?: number) => {
    try {
      // Convert zoom (0-100) to scale factor (0.5 to 2.0)
      // 50 = 1.0 (no zoom), 0 = 0.5 (zoom out), 100 = 2.0 (zoom in)
      const zoomFactor = 0.5 + (zoomValue / 100) * 1.5;
      const vertPos = vertPosition !== undefined ? vertPosition : verticalPositionRef.current;
      const horzPos = horzPosition !== undefined ? horzPosition : horizontalPositionRef.current;
      
      // Use square crop for profile pictures with better quality
      const resized = await resizeImageSquare(imageSrc, 400, 0.85, zoomFactor, vertPos, horzPos);
      setPreview(resized);
      setValue('userPicture', resized);
    } catch (error) {
      console.error('Error applying zoom:', error);
      // Fallback: use image without zoom
      try {
        const fallbackResized = await resizeImageSquare(imageSrc, 400, 0.85);
        setPreview(fallbackResized);
        setValue('userPicture', fallbackResized);
      } catch (fallbackError) {
        console.error('Error with fallback resize:', fallbackError);
        setPreview(imageSrc);
        setValue('userPicture', imageSrc);
      }
    }
  };

  const handleZoomChange = (zoomValue: number) => {
    setZoom(zoomValue);
    zoomRef.current = zoomValue;
    if (originalImage && isEditMode) {
      applyZoom(originalImage, zoomValue, verticalPositionRef.current, horizontalPositionRef.current);
    }
  };

  const handleVerticalPositionChange = (position: number) => {
    setVerticalPosition(position);
    verticalPositionRef.current = position;
    if (originalImage && isEditMode) {
      applyZoom(originalImage, zoomRef.current, position, horizontalPositionRef.current);
    }
  };

  const handleHorizontalPositionChange = (position: number) => {
    setHorizontalPosition(position);
    horizontalPositionRef.current = position;
    if (originalImage && isEditMode) {
      applyZoom(originalImage, zoomRef.current, verticalPositionRef.current, position);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemovePicture = () => {
    setPreview(null);
    setOriginalImage(null);
    setZoom(50);
    setVerticalPosition(50);
    setHorizontalPosition(50);
    zoomRef.current = 50;
    verticalPositionRef.current = 50;
    horizontalPositionRef.current = 50;
    setIsEditMode(false);
    setValue('userPicture', '');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex-1 animate-fade-in md:py-4 flex flex-col gap-6">
      {/* Logo and Adjustments Section */}
      <section className="flex flex-col items-center gap-3 md:gap-2 md:mt-0">
        <div className={`flex flex-col items-center gap-3 md:gap-2 ${preview && isEditMode ? 'pt-4 md:pt-0' : ''}`}>
          {/* Horizontal slider - top */}
          {preview && isEditMode && (
            <div className="flex items-center gap-2">
              {/* Spacer to match vertical slider space */}
              <div className="w-1"></div>
              <div className="w-24 flex justify-center">
                <div className="w-[91.2px]">
                  <HorizontalSlider initialPosition={horizontalPosition} onPositionChange={handleHorizontalPositionChange} />
                </div>
              </div>
              {/* Spacer for buttons area */}
              <div className="w-4"></div>
            </div>
          )}
          {/* Main container: vertical slider + image + buttons */}
          <div className="relative flex items-center gap-3 md:gap-2">
            {preview && isEditMode && (
              <div className="h-[91.2px] flex items-center justify-center">
                <VerticalSlider initialPosition={verticalPosition} onPositionChange={handleVerticalPositionChange} />
              </div>
            )}
            <div className="relative flex items-start justify-end gap-1.5">
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
                <div className="flex flex-col gap-3 md:gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemovePicture();
                    }}
                    className="w-6 h-6 md:w-4 md:h-4 rounded bg-red-500 border-2 border-red-500 flex items-center justify-center cursor-pointer hover:bg-red-600 transition-colors shadow-lg"
                    aria-label={tFields('removeProfilePicture')}
                  >
                    <X className="w-3.5 h-3.5 md:w-2.5 md:h-2.5 text-white font-bold" strokeWidth={3} />
                  </button>
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      setIsEditMode(true);
                      // Apply final adjustments before saving
                      if (originalImage) {
                        await applyZoom(originalImage, zoomRef.current, verticalPositionRef.current, horizontalPositionRef.current);
                      }
                    }}
                    className="w-6 h-6 md:w-4 md:h-4 rounded bg-black border-2 border-black flex items-center justify-center cursor-pointer hover:bg-gray-800 transition-colors shadow-lg"
                    aria-label="Edit profile picture"
                  >
                    <Pencil className="w-3.5 h-3.5 md:w-2.5 md:h-2.5 text-white" strokeWidth={2} />
                  </button>
                  {isEditMode && (
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        // Apply final adjustments before saving
                        if (originalImage) {
                          await applyZoom(originalImage, zoomRef.current, verticalPositionRef.current, horizontalPositionRef.current);
                        }
                        setIsEditMode(false);
                      }}
                      className="w-6 h-6 md:w-4 md:h-4 rounded bg-green-500 border-2 border-green-500 flex items-center justify-center cursor-pointer hover:bg-green-600 transition-colors shadow-lg"
                      aria-label="Confirm image adjustments"
                    >
                      <Check className="w-3.5 h-3.5 md:w-2.5 md:h-2.5 text-white" strokeWidth={3} />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          {/* Zoom slider - bottom */}
          {preview && isEditMode && (
            <div className="flex items-center gap-2">
              {/* Spacer to match vertical slider space */}
              <div className="w-1"></div>
              <div className="w-24 flex justify-center">
                <div className="w-[91.2px]">
                  <ZoomSlider initialZoom={zoom} onZoomChange={handleZoomChange} />
                </div>
              </div>
              {/* Spacer for buttons area */}
              <div className="w-4"></div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-black">{tFields('uploadPicture')}</span>
          <TipModal message="It will only be publicly visible on comments on business card" />
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
          disabled={isSubmitting}
        />
      </section>

      {/* How did you hear about us? Section */}
      <section className="flex flex-col">
        <FormField 
          label={
            <span className="flex items-center">
              <span className="animate-icon-slide-in-email">
                <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </span>
              <span>{tFields('referralLabel')}</span>
            </span>
          } 
          required 
          error={errors.referral?.message}
          tip="Help us understand how you found our platform"
        >
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
      </section>

      {/* Referral Other Section */}
      {referral === 'Other' && (
        <section className="flex flex-col">
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
        </section>
      )}

      {/* First Name Section */}
      <section className="flex flex-col">
        <FormField 
          label={
            <span className="flex items-center">
              <span className="animate-icon-slide-in-email">
                <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </span>
              <span>{tFields('firstNameLabel')}</span>
            </span>
          } 
          required 
          error={errors.firstName?.message}
          tip="For Identification and communication purpose"
        >
          <Input
            {...register('firstName')}
            id="firstName"
            type="text"
            value={firstName || ''}
            onClear={() => setValue('firstName', '')}
            showClear
            required
            placeholder={animatedPlaceholders[0]}
            disabled={isSubmitting}
            error={errors.firstName?.message}
          />
        </FormField>
      </section>

      {/* Last Name Section */}
      <section className="flex flex-col">
        <FormField 
          label={
            <span className="flex items-center">
              <span className="animate-icon-slide-in-lastname">
                <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </span>
              <span>{tFields('lastNameLabel')}</span>
            </span>
          } 
          required 
          error={errors.lastName?.message}
          tip="For Identification and communication purpose"
        >
          <Input
            {...register('lastName')}
            id="lastName"
            type="text"
            value={lastName || ''}
            onClear={() => setValue('lastName', '')}
            showClear
            required
            placeholder={animatedPlaceholders[1]}
            disabled={isSubmitting}
            error={errors.lastName?.message}
          />
        </FormField>
      </section>
    </div>
  );
}

