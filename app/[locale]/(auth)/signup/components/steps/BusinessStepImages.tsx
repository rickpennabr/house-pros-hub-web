'use client';

import React, { useRef } from 'react';
import { useFormContext } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { X, ImagePlus, ChevronDown } from 'lucide-react';
import type { BusinessFormValues } from '@/lib/schemas/business';

const MAX_IMAGES = 10;
const GALLERY_INPUT_ID = 'gallery-images-input';

export function BusinessStepImages() {
  const t = useTranslations('businessForm.images');
  const { setValue, watch, getValues, formState: { errors, isSubmitting } } = useFormContext<BusinessFormValues>();
  const inputRef = useRef<HTMLInputElement>(null);

  const images = watch('images') ?? [];
  const imageErrors = errors.images;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    e.target.value = '';
    if (!fileList?.length) return;
    const currentImages = getValues('images') ?? [];
    const remaining = MAX_IMAGES - currentImages.length;
    if (remaining <= 0) return;
    const imageFiles = Array.from(fileList).filter((f) => f.type.startsWith('image/')).slice(0, remaining);
    if (imageFiles.length === 0) return;

    let processed = 0;
    const newDataUrls: string[] = [];

    const readNext = () => {
      if (processed >= imageFiles.length) {
        const latest = getValues('images') ?? [];
        setValue('images', [...latest, ...newDataUrls], { shouldValidate: true });
        return;
      }
      const file = imageFiles[processed]!;
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result && typeof reader.result === 'string') {
          newDataUrls.push(reader.result);
        }
        processed += 1;
        readNext();
      };
      reader.onerror = () => {
        processed += 1;
        readNext();
      };
      reader.readAsDataURL(file);
    };
    readNext();
  };

  const removeImage = (index: number) => {
    const next = images.filter((_, i) => i !== index);
    setValue('images', next, { shouldValidate: true });
  };

  const canAdd = images.length < MAX_IMAGES;

  return (
    <div className="space-y-6 flex-1">
      <div className="border-2 border-black rounded-lg bg-white">
        <button
          type="button"
          className="w-full flex items-center justify-between p-2 text-left bg-black text-white cursor-pointer"
        >
          <label className="block text-base font-bold text-white">{t('instructionsTitle')}</label>
          <ChevronDown className="w-5 h-5 text-white" />
        </button>
        <div className="px-4 pb-4 border-t-2 border-black">
          <p className="text-sm text-gray-600 mt-2">{t('instructionsLine1')}</p>
          <p className="text-sm text-gray-600">{t('instructionsLine2')}</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-8">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700">
              {t('sectionTitle')}
            </label>
            <span className="text-xs text-gray-500">
              {t('imagesHelp', { max: MAX_IMAGES })}
            </span>
          </div>
          <label
            htmlFor={GALLERY_INPUT_ID}
            className={`px-3 py-1.5 text-sm border-2 border-black rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
              isSubmitting || !canAdd
                ? 'opacity-50 cursor-not-allowed pointer-events-none'
                : 'hover:bg-gray-100'
            }`}
          >
            <ImagePlus className="w-4 h-4 shrink-0" />
            {t('addImageButton')}
          </label>
        </div>
        <input
          id={GALLERY_INPUT_ID}
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          disabled={isSubmitting || !canAdd}
          className="sr-only"
          aria-label={t('addImageButton')}
        />

        {imageErrors?.message && (
          <p className="text-sm text-red-600">{imageErrors.message as string}</p>
        )}

        {images.length === 0 ? (
          <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
            {t('noImages')}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {images.map((url, index) => (
              <div
                key={`${url.slice(0, 50)}-${index}`}
                className="relative aspect-square rounded-lg border-2 border-black overflow-hidden bg-gray-100"
              >
                {url.startsWith('data:') || url.startsWith('http') ? (
                  <Image
                    src={url}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 20vw"
                    unoptimized={url.startsWith('data:')}
                  />
                ) : null}
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute top-1 right-1 p-1 rounded-full bg-red-500 text-white cursor-pointer hover:bg-red-600 transition-colors"
                  disabled={isSubmitting}
                  aria-label={t('removeImageAria', { index: index + 1 })}
                >
                  <X className="w-4 h-4" />
                </button>
                <span className="absolute bottom-1 left-1 bg-black/70 text-white text-xs px-2 py-0.5 rounded">
                  {index + 1} / {MAX_IMAGES}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
