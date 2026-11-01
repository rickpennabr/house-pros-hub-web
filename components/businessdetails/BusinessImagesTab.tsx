'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Minus, Pencil, Plus, Loader2 } from 'lucide-react';
import { validateFileSize } from '@/lib/utils/fileValidation';
import { getCsrfToken } from '@/lib/utils/csrf';

const MAX_IMAGES = 10;

interface BusinessImagesTabProps {
  images?: string[];
  businessName: string;
  isOwner?: boolean;
  businessId?: string;
  onImagesChange?: (newImages: string[]) => void;
}

export default function BusinessImagesTab({
  images,
  businessName,
  isOwner = false,
  businessId,
  onImagesChange,
}: BusinessImagesTabProps) {
  const t = useTranslations('businessForm.images');
  const list = images && images.length > 0 ? images : [];
  const [editMode, setEditMode] = useState(false);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleRemoveImage = async (index: number) => {
    if (!businessId || !onImagesChange || list.length <= 0) return;
    const newList = list.filter((_, i) => i !== index);
    setDeletingIndex(index);
    try {
      const csrfToken = await getCsrfToken();
      const res = await fetch(`/api/businesses/${businessId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({ images: newList }),
      });
      if (res.ok) {
        onImagesChange(newList);
        if (newList.length === 0) setEditMode(false);
      }
    } catch (e) {
      console.error('Failed to remove image', e);
    } finally {
      setDeletingIndex(null);
    }
  };

  const handleAddImagesClick = () => {
    if (!isOwner || !businessId || list.length >= MAX_IMAGES) return;
    setUploadError(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList?.length || !businessId || !onImagesChange) return;

    const remaining = MAX_IMAGES - list.length;
    const imageFiles = Array.from(fileList)
      .filter((f) => f.type.startsWith('image/'))
      .slice(0, remaining);

    const invalidSize = imageFiles.find((f) => !validateFileSize(f.size, 'gallery'));
    if (invalidSize) {
      setUploadError('Each image must be under 5MB.');
      e.target.value = '';
      return;
    }
    if (imageFiles.length === 0) {
      setUploadError('Please select JPEG, PNG, or WebP images.');
      e.target.value = '';
      return;
    }

    setUploadError(null);
    setUploading(true);
    let current = [...list];
    try {
      const csrfToken = await getCsrfToken();
      for (const file of imageFiles) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('businessId', businessId);
        const res = await fetch('/api/storage/upload-business-image', {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to upload image');
        }
        const result = await res.json();
        if (result?.url) {
          current = [...current, result.url];
          const updateRes = await fetch(`/api/businesses/${businessId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': csrfToken,
            },
            credentials: 'include',
            body: JSON.stringify({ images: current }),
          });
          if (updateRes.ok) onImagesChange(current);
        }
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // No images
  if (list.length === 0) {
    if (isOwner) {
      return (
        <div className="bg-white py-12 px-4 text-center">
          <p className="text-gray-700 font-medium mb-4">{t('addImagesPrompt')}</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={handleFileChange}
            disabled={uploading}
          />
          <button
            type="button"
            onClick={handleAddImagesClick}
            disabled={uploading}
            className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-black bg-black text-white px-6 py-2.5 font-medium hover:bg-gray-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {uploading ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden /> : null}
            {uploading ? 'Uploading...' : t('addButton')}
          </button>
          {uploadError && <p className="mt-3 text-sm text-red-600">{uploadError}</p>}
        </div>
      );
    }
    return (
      <div className="bg-white py-12 text-center text-gray-500">
        <p>{t('noGalleryYet')}</p>
      </div>
    );
  }

  // Has images
  const canAddMore = isOwner && businessId && list.length < MAX_IMAGES;

  return (
    <div className="bg-white">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={handleFileChange}
        disabled={uploading}
      />
      {isOwner && (
        <div className="flex flex-wrap items-center justify-end gap-2 mb-3">
          {canAddMore && (
            <button
              type="button"
              onClick={handleAddImagesClick}
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-lg border-2 border-black bg-black text-white px-4 py-2 text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Plus className="w-4 h-4" aria-hidden />}
              {uploading ? 'Uploading...' : t('addButton')}
            </button>
          )}
          {editMode ? (
            <button
              type="button"
              onClick={() => setEditMode(false)}
              className="inline-flex items-center gap-2 rounded-lg border-2 border-black bg-white px-4 py-2 text-sm font-medium hover:bg-gray-100 transition-colors"
            >
              {t('doneButton')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setEditMode(true)}
              className="inline-flex items-center gap-2 rounded-lg border-2 border-black bg-white px-4 py-2 text-sm font-medium hover:bg-gray-100 transition-colors"
            >
              <Pencil className="w-4 h-4" aria-hidden />
              {t('editButton')}
            </button>
          )}
        </div>
      )}
      {uploadError && <p className="mb-3 text-sm text-red-600">{uploadError}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {list.map((url, index) => (
          <div
            key={`${url}-${index}`}
            className="relative aspect-square rounded-lg border-2 border-black overflow-hidden bg-gray-100"
          >
            <Image
              src={url}
              alt={`${businessName} gallery image ${index + 1}`}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
              unoptimized={url.startsWith('data:')}
            />
            {isOwner && editMode && (
              <button
                type="button"
                onClick={() => handleRemoveImage(index)}
                disabled={deletingIndex !== null}
                className="absolute top-1 right-1 p-1.5 rounded-full bg-black/70 text-white hover:bg-black disabled:opacity-50 transition-colors"
                aria-label={t('removeImageAria', { index: index + 1 })}
              >
                <Minus className="w-4 h-4" aria-hidden />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
