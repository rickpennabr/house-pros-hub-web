'use client';

import { FormEvent, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { GripVertical, Minus, Pencil, Plus, Loader2, X } from 'lucide-react';
import { TypingSearchInput } from '@/components/common/TypingSearchInput';
import { validateFileSize } from '@/lib/utils/fileValidation';
import { getCsrfToken } from '@/lib/utils/csrf';
import { MAX_BUSINESS_GALLERY_IMAGES } from '@/lib/constants/businessGallery';
import { ImageSlideViewer } from '@/components/media/ImageSlides';
import type { GalleryImage } from '@/lib/business/gallery';

const MAX_IMAGES = MAX_BUSINESS_GALLERY_IMAGES;
const MAX_TAGS = 8;

interface BusinessImagesTabProps {
  /** Preferred: photos with tags for search. */
  gallery?: GalleryImage[];
  /** Older callers that only pass URLs. */
  images?: string[];
  businessName: string;
  isOwner?: boolean;
  businessId?: string;
  onGalleryChange?: (gallery: GalleryImage[]) => void;
  onImagesChange?: (images: string[]) => void;
}

function asGallery(gallery: GalleryImage[] | undefined, images: string[] | undefined): GalleryImage[] {
  if (gallery && gallery.length > 0) return gallery;
  return (images ?? []).map((url) => ({ url, tags: [] }));
}

function matchesQuery(item: GalleryImage, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return item.tags.some((tag) => tag.toLowerCase().includes(needle));
}

export default function BusinessImagesTab({
  gallery,
  images,
  businessName,
  isOwner = false,
  businessId,
  onGalleryChange,
  onImagesChange,
}: BusinessImagesTabProps) {
  const t = useTranslations('businessForm.images');
  const list = asGallery(gallery, images);
  const [editMode, setEditMode] = useState(false);
  const [query, setQuery] = useState('');
  const [tagDrafts, setTagDrafts] = useState<Record<string, string>>({});
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [savingTags, setSavingTags] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tagInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const dragFromRef = useRef<number | null>(null);
  const draggedRef = useRef(false);
  const [slideIndex, setSlideIndex] = useState<number | null>(null);

  const focusTagInput = (url: string) => {
    requestAnimationFrame(() => {
      tagInputRefs.current[url]?.focus();
    });
  };

  const visible = useMemo(() => list.filter((item) => matchesQuery(item, query)), [list, query]);
  const visibleIndexes = useMemo(
    () => list.map((item, index) => (matchesQuery(item, query) ? index : -1)).filter((index) => index >= 0),
    [list, query]
  );

  const publish = (next: GalleryImage[]) => {
    onGalleryChange?.(next);
    onImagesChange?.(next.map((item) => item.url));
  };

  const saveGallery = async (next: GalleryImage[], fallback: GalleryImage[]) => {
    if (!businessId) return false;
    const csrfToken = await getCsrfToken();
    const res = await fetch(`/api/businesses/${businessId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      credentials: 'include',
      body: JSON.stringify({ images: next }),
    });
    if (!res.ok) {
      publish(fallback);
      try {
        const body = (await res.json()) as { error?: string };
        setUploadError(typeof body.error === 'string' && body.error.trim() ? body.error : t('saveError'));
      } catch {
        setUploadError(t('saveError'));
      }
      return false;
    }
    return true;
  };

  const handleRemoveImage = async (index: number) => {
    if (!businessId || list.length <= 0 || savingOrder || uploading || savingTags) return;
    const previous = list;
    const next = list.filter((_, i) => i !== index);
    setDeletingIndex(index);
    setUploadError(null);
    publish(next);
    try {
      const ok = await saveGallery(next, previous);
      if (ok && next.length === 0) setEditMode(false);
    } catch (e) {
      console.error('Failed to remove image', e);
      publish(previous);
      setUploadError(t('removeError'));
    } finally {
      setDeletingIndex(null);
    }
  };

  const handleReorder = async (from: number, to: number) => {
    if (!businessId || from === to || uploading || deletingIndex !== null || savingTags) return;
    const previous = list;
    const next = [...previous];
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);
    publish(next);
    setSavingOrder(true);
    setUploadError(null);
    try {
      await saveGallery(next, previous);
    } catch (e) {
      console.error('Failed to reorder images', e);
      publish(previous);
      setUploadError(t('reorderError'));
    } finally {
      setSavingOrder(false);
    }
  };

  const handleAddImagesClick = () => {
    if (!isOwner || !businessId || list.length >= MAX_IMAGES || savingOrder || savingTags) return;
    setUploadError(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList?.length || !businessId) return;

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
          current = [...current, { url: result.url as string, tags: [] }];
          const updateRes = await fetch(`/api/businesses/${businessId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': csrfToken,
            },
            credentials: 'include',
            body: JSON.stringify({ images: current }),
          });
          if (!updateRes.ok) {
            throw new Error(t('saveError'));
          }
          publish(current);
        }
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : t('saveError'));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const addTag = async (index: number, rawTag: string) => {
    if (!businessId || savingTags || uploading || savingOrder) return;
    const tag = rawTag.trim().replace(/\s+/g, ' ').slice(0, 32);
    if (!tag) return;
    const item = list[index];
    if (!item) return;
    if (item.tags.some((existing) => existing.toLowerCase() === tag.toLowerCase())) {
      setTagDrafts((current) => ({ ...current, [item.url]: '' }));
      return;
    }
    if (item.tags.length >= MAX_TAGS) {
      setUploadError(t('tagLimit'));
      return;
    }
    const previous = list;
    const next = list.map((entry, i) => (i === index ? { ...entry, tags: [...entry.tags, tag] } : entry));
    setTagDrafts((current) => ({ ...current, [item.url]: '' }));
    setUploadError(null);
    publish(next);
    setSavingTags(true);
    try {
      await saveGallery(next, previous);
    } catch (e) {
      console.error('Failed to save tags', e);
      publish(previous);
      setUploadError(t('tagSaveError'));
    } finally {
      setSavingTags(false);
    }
  };

  const removeTag = async (index: number, tag: string) => {
    if (!businessId || savingTags || uploading || savingOrder) return;
    const previous = list;
    const next = list.map((entry, i) =>
      i === index ? { ...entry, tags: entry.tags.filter((value) => value !== tag) } : entry
    );
    setUploadError(null);
    publish(next);
    setSavingTags(true);
    try {
      await saveGallery(next, previous);
    } catch (e) {
      console.error('Failed to remove tag', e);
      publish(previous);
      setUploadError(t('tagSaveError'));
    } finally {
      setSavingTags(false);
    }
  };

  const onTagSubmit = (event: FormEvent, index: number, url: string) => {
    event.preventDefault();
    void addTag(index, tagDrafts[url] ?? '');
    focusTagInput(url);
  };

  if (list.length === 0) {
    if (isOwner) {
      return (
        <div className="bg-white">
          <div className="px-4 py-12 text-center">
            <p className="mb-4 font-medium text-gray-700">{t('addImagesPrompt')}</p>
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
              className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-black bg-black px-6 py-2.5 font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : null}
              {uploading ? 'Uploading...' : t('addButton')}
            </button>
            {uploadError && <p className="mt-3 text-sm text-red-600">{uploadError}</p>}
          </div>
        </div>
      );
    }
    return (
      <div className="bg-white">
        <div className="py-12 text-center text-gray-500">
          <p>{t('noGalleryYet')}</p>
        </div>
      </div>
    );
  }

  const canAddMore = isOwner && businessId && list.length < MAX_IMAGES;
  const canReorder = Boolean(
    isOwner &&
      businessId &&
      list.length > 1 &&
      !uploading &&
      deletingIndex === null &&
      !savingOrder &&
      !savingTags &&
      !query.trim()
  );

  return (
    <div className="space-y-3 bg-white">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={handleFileChange}
        disabled={uploading}
      />

      <div className="flex items-center gap-2">
        <TypingSearchInput
          value={query}
          onChange={setQuery}
          placeholder={t('search')}
          clearLabel={t('clearSearch')}
        />
        {isOwner ? (
          editMode ? (
            <button
              type="button"
              onClick={() => setEditMode(false)}
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border-2 border-black bg-white px-4 text-sm font-medium hover:bg-gray-100"
            >
              {t('doneButton')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setEditMode(true)}
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border-2 border-black bg-white px-4 text-sm font-medium hover:bg-gray-100"
            >
              <Pencil className="h-4 w-4" aria-hidden />
              {t('editButton')}
            </button>
          )
        ) : null}
        {canAddMore ? (
          <button
            type="button"
            onClick={handleAddImagesClick}
            disabled={uploading || savingOrder || savingTags}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border-2 border-black bg-black px-4 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
            {uploading ? 'Uploading...' : t('addButton')}
          </button>
        ) : null}
      </div>

      {isOwner && list.length > 1 && !query.trim() ? (
        <p className="text-sm text-gray-600">{savingOrder ? t('savingOrder') : t('reorderHint')}</p>
      ) : null}
      {isOwner && editMode ? <p className="text-sm text-gray-600">{t('tagHint')}</p> : null}
      {uploadError ? <p className="text-sm text-red-600">{uploadError}</p> : null}
      {visible.length === 0 ? <p className="text-sm text-gray-600">{t('noSearchResults')}</p> : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {visibleIndexes.map((index) => {
          const item = list[index];
          if (!item) return null;
          const draft = tagDrafts[item.url] ?? '';
          return (
            <div key={`${item.url}-${index}`} className="space-y-2">
              <div
                draggable={canReorder}
                onDragStart={(event) => {
                  if (!canReorder) return;
                  dragFromRef.current = index;
                  draggedRef.current = true;
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', String(index));
                  const from = index;
                  requestAnimationFrame(() => setDraggingIndex(from));
                }}
                onDragOver={(event) => {
                  if (dragFromRef.current === null) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                  if (dragOverIndex !== index) setDragOverIndex(index);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const from = dragFromRef.current;
                  dragFromRef.current = null;
                  setDraggingIndex(null);
                  setDragOverIndex(null);
                  if (from === null || from === index) return;
                  void handleReorder(from, index);
                }}
                onDragEnd={() => {
                  dragFromRef.current = null;
                  setDraggingIndex(null);
                  setDragOverIndex(null);
                  requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                      draggedRef.current = false;
                    });
                  });
                }}
                onClick={() => {
                  if (draggedRef.current) {
                    draggedRef.current = false;
                    return;
                  }
                  if (editMode) return;
                  const openAt = visible.findIndex((entry) => entry.url === item.url);
                  setSlideIndex(openAt >= 0 ? openAt : 0);
                }}
                aria-label={canReorder ? t('dragImageAria', { index: index + 1 }) : undefined}
                className={`relative aspect-square overflow-hidden rounded-lg border-2 border-black bg-gray-100 ${
                  canReorder ? 'cursor-grab active:cursor-grabbing' : editMode ? 'cursor-default' : 'cursor-zoom-in'
                } ${draggingIndex === index ? 'opacity-40' : ''} ${
                  dragOverIndex === index && draggingIndex !== null && draggingIndex !== index
                    ? 'outline outline-2 outline-offset-2 outline-black'
                    : ''
                }`}
              >
                <Image
                  src={item.url}
                  alt={`${businessName} gallery image ${index + 1}`}
                  fill
                  draggable={false}
                  className="pointer-events-none object-cover"
                  sizes="(max-width: 1024px) 50vw, 25vw"
                  unoptimized={item.url.startsWith('data:')}
                />
                {canReorder ? (
                  <span className="pointer-events-none absolute bottom-1 left-1 rounded bg-black/70 p-1 text-white">
                    <GripVertical className="h-4 w-4" aria-hidden />
                  </span>
                ) : null}
                {isOwner && editMode ? (
                  <button
                    type="button"
                    draggable={false}
                    onDragStart={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onClick={() => void handleRemoveImage(index)}
                    disabled={deletingIndex !== null || savingOrder || savingTags}
                    className="absolute right-1 top-1 rounded-full bg-black/70 p-1.5 text-white transition-colors hover:bg-black disabled:opacity-50"
                    aria-label={t('removeImageAria', { index: index + 1 })}
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                ) : null}
              </div>

              {item.tags.length > 0 || (isOwner && editMode) ? (
                <div className="flex min-w-0 flex-nowrap gap-1 overflow-x-auto pb-0.5 scrollbar-custom">
                  {item.tags.map((tag) => (
                    <span
                      key={`${item.url}-${tag}`}
                      className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-black/20 bg-gray-100 px-2 py-0.5 text-xs font-medium text-black"
                    >
                      {tag}
                      {isOwner && editMode ? (
                        <button
                          type="button"
                          onClick={() => void removeTag(index, tag)}
                          disabled={savingTags}
                          className="text-gray-600 hover:text-black disabled:opacity-40"
                          aria-label={t('removeTagAria', { tag })}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      ) : null}
                    </span>
                  ))}
                </div>
              ) : null}

              {isOwner && editMode ? (
                <form onSubmit={(event) => onTagSubmit(event, index, item.url)} className="flex gap-1">
                  <input
                    ref={(el) => {
                      tagInputRefs.current[item.url] = el;
                    }}
                    type="text"
                    value={draft}
                    onChange={(event) =>
                      setTagDrafts((current) => ({ ...current, [item.url]: event.target.value }))
                    }
                    placeholder={t('tagPlaceholder')}
                    disabled={item.tags.length >= MAX_TAGS}
                    className="h-8 min-w-0 flex-1 rounded-lg border-2 border-black px-2 text-xs text-black placeholder:text-gray-500 focus:outline-none disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={savingTags || !draft.trim() || item.tags.length >= MAX_TAGS}
                    className="h-8 rounded-lg border-2 border-black bg-black px-2 text-xs font-medium text-white disabled:opacity-40"
                  >
                    {t('addTag')}
                  </button>
                </form>
              ) : null}
            </div>
          );
        })}
      </div>

      <ImageSlideViewer
        images={visible.map((item, index) => ({ src: item.url, alt: `${businessName} ${index + 1}` }))}
        open={slideIndex !== null}
        index={slideIndex ?? 0}
        label={businessName}
        onIndexChange={setSlideIndex}
        onClose={() => setSlideIndex(null)}
      />
    </div>
  );
}
