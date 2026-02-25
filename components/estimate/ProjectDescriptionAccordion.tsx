'use client';

import { useState, useRef } from 'react';
import { UseFormReturn } from 'react-hook-form';
import Image from 'next/image';
import { EstimateSchema } from '@/lib/schemas/estimate';
import { FormField } from '@/components/ui/FormField';
import Accordion from '@/components/ui/Accordion';
import { Upload, X } from 'lucide-react';

interface ProjectDescriptionAccordionProps {
  isOpen: boolean;
  onToggle: () => void;
  isComplete: boolean;
  methods: UseFormReturn<EstimateSchema>;
  errors: UseFormReturn<EstimateSchema>['formState']['errors'];
  isSubmitting: boolean;
  tAccordion: (key: string) => string;
  tFields: (key: string) => string;
  tHelp: (key: string) => string;
  tTips: (key: string) => string;
}

export default function ProjectDescriptionAccordion({
  isOpen,
  onToggle,
  isComplete,
  methods,
  errors,
  isSubmitting,
  tAccordion,
  tFields,
  tHelp,
  tTips,
}: ProjectDescriptionAccordionProps) {
  const { register, setValue, watch } = methods;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const projectImages = watch('projectImages') || [];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Check if adding these files would exceed the limit
    const remainingSlots = 5 - projectImages.length;
    if (files.length > remainingSlots) {
      setUploadError(tFields('maxImagesError'));
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setUploadError(null);
    setUploading(true);

    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        // Validate file type
        if (!file.type.startsWith('image/')) {
          throw new Error(tFields('imageTypeError'));
        }

        // Validate file size (5MB)
        if (file.size > 5 * 1024 * 1024) {
          throw new Error(tFields('imageSizeError'));
        }

        // Upload to storage
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/storage/upload-estimate-image', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || tFields('uploadError'));
        }

        const result = await response.json();
        return result.url;
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      const newImages = [...projectImages, ...uploadedUrls];
      setValue('projectImages', newImages, { shouldValidate: true });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : tFields('uploadError'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveImage = (index: number) => {
    const newImages = projectImages.filter((_, i) => i !== index);
    setValue('projectImages', newImages, { shouldValidate: true });
  };

  const handleUploadClick = () => {
    if (projectImages.length < 5 && !uploading) {
      fileInputRef.current?.click();
    }
  };

  return (
    <Accordion
      title={tAccordion('description')}
      isOpen={isOpen}
      onToggle={onToggle}
      isComplete={isComplete}
      error={errors.projectDescription ? tHelp('requiredFieldsHint') : undefined}
      required
      tip={tTips('description')}
    >
      <div className="space-y-4">
        <FormField label="" error={undefined}>
          <textarea
            {...register('projectDescription')}
            rows={5}
            placeholder={tFields('projectDescriptionPlaceholder')}
            className={`w-full px-3 py-2.5 border-2 rounded-lg focus:outline-none transition-all resize-none ${
              errors.projectDescription
                ? 'border-red-500 focus:border-red-500'
                : 'border-black'
            } bg-white`}
            disabled={isSubmitting}
          />
        </FormField>

        {/* Image Upload Section */}
        <div className="space-y-2">
          <label className="block text-sm font-bold text-black">
            {tFields('projectImagesLabel')} ({projectImages.length}/5)
          </label>
          
          {/* Image Grid */}
          {projectImages.length > 0 && (
            <div className="grid grid-cols-5 gap-3">
              {projectImages.map((imageUrl, index) => (
                <div key={index} className="relative aspect-square rounded-lg border-2 border-black overflow-hidden bg-white">
                  <Image
                    src={imageUrl}
                    alt={`Project image ${index + 1}`}
                    fill
                    className="object-cover"
                    sizes="20vw"
                    unoptimized
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(index)}
                    disabled={isSubmitting || uploading}
                    className="absolute top-1 right-1 w-6 h-6 rounded bg-red-500 border-2 border-red-500 flex items-center justify-center cursor-pointer hover:bg-red-600 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label={tFields('removeImage')}
                  >
                    <X className="w-3 h-3 text-white font-bold" strokeWidth={3} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Upload Button */}
          {projectImages.length < 5 && (
            <div>
              <button
                type="button"
                onClick={handleUploadClick}
                disabled={isSubmitting || uploading}
                className={`w-full py-3 px-4 border-2 rounded-lg flex items-center justify-center gap-2 transition-all ${
                  uploading
                    ? 'border-gray-400 bg-gray-100 cursor-not-allowed'
                    : 'border-black bg-white hover:bg-gray-50 cursor-pointer'
                }`}
              >
                <Upload className={`w-5 h-5 ${uploading ? 'text-gray-400' : 'text-black'}`} />
                <span className={`text-sm font-medium ${uploading ? 'text-gray-400' : 'text-black'}`}>
                  {uploading ? tFields('uploading') : tFields('uploadImages')}
                </span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={handleFileChange}
                className="hidden"
                disabled={isSubmitting || uploading}
              />
            </div>
          )}

          {/* Error Message */}
          {uploadError && (
            <p className="text-sm text-red-600">{uploadError}</p>
          )}

          {/* Helper Text */}
          <p className="text-xs text-gray-600">
            {tFields('projectImagesHelp')}
          </p>
        </div>
      </div>
    </Accordion>
  );
}

