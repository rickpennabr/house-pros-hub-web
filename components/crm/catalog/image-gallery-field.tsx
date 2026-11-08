'use client';

import { useRef } from 'react';
import { ChevronLeft, ChevronRight, GripVertical, ImagePlus, Star, X } from 'lucide-react';

export interface DraftImage {
  key: string;
  previewUrl: string;
  file?: File;
  imageUrl?: string;
  storagePath?: string | null;
  isThumbnail: boolean;
}

interface ImageGalleryFieldProps {
  images: DraftImage[];
  max: number;
  onChange: (images: DraftImage[]) => void;
}

function withSingleThumbnail(images: DraftImage[], thumbnailKey: string): DraftImage[] {
  return images.map((image) => ({ ...image, isThumbnail: image.key === thumbnailKey }));
}

export async function uploadDraftImages(images: DraftImage[], folder: 'services' | 'products') {
  const uploaded: { image_url: string; storage_path: string | null; is_thumbnail: boolean }[] = [];
  for (const image of images) {
    if (image.file) {
      const body = new FormData();
      body.set('file', image.file);
      body.set('folder', folder);
      const response = await fetch('/api/crm/catalog/images', { method: 'POST', credentials: 'include', body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Failed to upload a photo');
      uploaded.push({
        image_url: data.image_url,
        storage_path: data.storage_path ?? null,
        is_thumbnail: image.isThumbnail,
      });
      continue;
    }
    if (image.imageUrl) {
      uploaded.push({
        image_url: image.imageUrl,
        storage_path: image.storagePath ?? null,
        is_thumbnail: image.isThumbnail,
      });
    }
  }
  return uploaded;
}

export function ImageGalleryField({ images, max, onChange }: ImageGalleryFieldProps) {
  const dragIndex = useRef<number | null>(null);
  const remaining = max - images.length;

  const addFiles = (list: FileList | null) => {
    if (!list || remaining <= 0) return;
    const next = [...images];
    Array.from(list)
      .slice(0, remaining)
      .forEach((file) => {
        next.push({
          key: crypto.randomUUID(),
          previewUrl: URL.createObjectURL(file),
          file,
          isThumbnail: next.length === 0,
        });
      });
    if (!next.some((image) => image.isThumbnail) && next[0]) next[0].isThumbnail = true;
    onChange(next);
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    onChange(next);
  };

  const remove = (key: string) => {
    const target = images.find((image) => image.key === key);
    if (target?.file) URL.revokeObjectURL(target.previewUrl);
    const next = images.filter((image) => image.key !== key);
    if (target?.isThumbnail && next[0]) next[0] = { ...next[0], isThumbnail: true };
    onChange(next);
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-gray-700">Photos</span>
        <span className="text-xs text-gray-500">
          {images.length}/{max}. Drag to reorder. One photo is the thumbnail.
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {images.map((image, index) => (
          <div
            key={image.key}
            draggable
            onDragStart={() => {
              dragIndex.current = index;
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              const from = dragIndex.current;
              dragIndex.current = null;
              if (from == null || from === index) return;
              const next = [...images];
              const [item] = next.splice(from, 1);
              next.splice(index, 0, item);
              onChange(next);
            }}
            className={`relative overflow-hidden rounded-lg border-2 bg-neutral-100 ${
              image.isThumbnail ? 'border-black' : 'border-gray-300'
            }`}
          >
            <img src={image.previewUrl} alt="" className="h-24 w-full object-cover" />
            <div className="absolute left-1 top-1 rounded bg-white/90 p-0.5 text-gray-700">
              <GripVertical className="h-3.5 w-3.5" aria-hidden />
            </div>
            {image.isThumbnail ? (
              <span className="absolute right-1 top-1 rounded bg-black px-1.5 py-0.5 text-[10px] font-semibold text-white">
                Thumb
              </span>
            ) : null}
            <div className="flex items-center justify-between bg-white px-1 py-1">
              <button type="button" className="p-0.5" aria-label="Move photo left" onClick={() => move(index, -1)}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="p-0.5"
                aria-label="Use as thumbnail"
                onClick={() => onChange(withSingleThumbnail(images, image.key))}
              >
                <Star className={`h-3.5 w-3.5 ${image.isThumbnail ? 'fill-black' : ''}`} />
              </button>
              <button type="button" className="p-0.5" aria-label="Move photo right" onClick={() => move(index, 1)}>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <button type="button" className="p-0.5 text-red-600" aria-label="Remove photo" onClick={() => remove(image.key)}>
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
        {remaining > 0 ? (
          <label className="flex h-24 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-black text-xs font-medium text-gray-700">
            <ImagePlus className="mb-1 h-5 w-5" />
            Add photo
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(event) => {
                addFiles(event.target.files);
                event.target.value = '';
              }}
            />
          </label>
        ) : null}
      </div>
    </div>
  );
}
