'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Check, Download, EyeOff, FileText, FolderInput, HardDrive, ImagePlus, MoreHorizontal, Plus, Share2, SlidersHorizontal, Tag, Trash2, Upload, Video, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { ProDrivePicker } from '@/components/drive/ProDrivePicker';
import { JobPhotoViewer, type JobPhoto } from '@/components/media/JobPhotoViewer';
import type { DriveFile } from '@/lib/drive/types';

interface JobCustomerAlbumProps {
  open: boolean;
  projectId: string;
  name: string;
  address: string;
  customerId: string;
  onBack: () => void;
  onCamera: () => void;
  onWalkthrough: () => void;
  onTakeAfter: (photoId: string) => void;
  onUpload: (files: File[]) => Promise<void>;
}

const BULK_TAGS = ['Front Side', 'Back Side', 'Left Side', 'Right Side', 'Before and After', 'Finished', 'Document'];

function dayKey(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function isSameDay(iso: string, now: Date): boolean {
  const date = new Date(iso);
  return date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
}

/**
 * Photos already saved for the customer. The camera stays closed until the shutter button.
 */
export function JobCustomerAlbum({ open, projectId, name, address, customerId, onBack, onCamera, onWalkthrough, onTakeAfter, onUpload }: JobCustomerAlbumProps) {
  const t = useTranslations('jobsite');
  const locale = useLocale();
  const [photos, setPhotos] = useState<JobPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sheet, setSheet] = useState<'filter' | 'add' | 'actions' | 'move' | 'bulkTags' | null>(null);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [working, setWorking] = useState(false);
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [kind, setKind] = useState<'all' | 'photo' | 'video'>('all');
  const [tag, setTag] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    if (refresh === 0) setViewingId(null);
    void fetch(`/api/crm/projects/${projectId}/photos`, { credentials: 'include' })
      .then((response) => response.json())
      .then((body: { photos?: JobPhoto[]; error?: string; businessId?: string | null }) => {
        if (cancelled) return;
        setBusinessId(body.businessId ?? null);
        if (!Array.isArray(body.photos)) {
          setError(body.error || t('loadFailed'));
          setPhotos([]);
          return;
        }
        setPhotos(body.photos.map((photo) => ({
          id: photo.id,
          caption: photo.caption,
          takenAt: photo.takenAt,
          name: photo.name,
          mimeType: photo.mimeType ?? '',
          url: photo.url,
          tags: photo.tags ?? [],
          latitude: photo.latitude ?? null,
          longitude: photo.longitude ?? null,
          accuracyM: photo.accuracyM ?? null,
          headingDeg: photo.headingDeg ?? null,
          hidden: Boolean(photo.hidden),
          isCover: Boolean(photo.isCover),
          pairedPhotoId: photo.pairedPhotoId ?? null,
        })));
      })
      .catch(() => {
        if (!cancelled) setError(t('loadFailed'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, projectId, refresh, t]);

  const addFromDrive = async (file: DriveFile) => {
    if (!file.mimeType.startsWith('image/') && !file.mimeType.startsWith('video/')) {
      setError(t('drivePhotoOnly'));
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const response = await fetch(`/api/crm/projects/${projectId}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          driveFileId: file.id,
          takenAt: new Date().toISOString(),
        }),
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error || t('saveFailed'));
      }
      setRefresh((value) => value + 1);
    } catch (linkError) {
      setError(linkError instanceof Error ? linkError.message : t('saveFailed'));
    } finally {
      setUploading(false);
    }
  };

  const chosenPhotos = () => photos.filter((photo) => selectedIds.includes(photo.id));

  const patchSelected = async (bodyFor: (photo: JobPhoto) => Record<string, unknown>) => {
    const chosen = chosenPhotos();
    if (chosen.length === 0) return;
    setWorking(true);
    setError(null);
    try {
      for (const photo of chosen) {
        const response = await fetch(`/api/crm/projects/${projectId}/photos/${photo.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(bodyFor(photo)),
        });
        if (!response.ok) {
          const payload = (await response.json()) as { error?: string };
          throw new Error(payload.error || t('saveFailed'));
        }
      }
      setSheet(null);
      setSelectedIds([]);
      setSelecting(false);
      setRefresh((value) => value + 1);
    } catch (patchError) {
      setError(patchError instanceof Error ? patchError.message : t('saveFailed'));
    } finally {
      setWorking(false);
    }
  };

  const shareSelected = async () => {
    const chosen = chosenPhotos().filter((photo) => photo.url);
    const files: File[] = [];
    for (const photo of chosen.slice(0, 10)) {
      try {
        const response = await fetch(photo.url as string);
        const blob = await response.blob();
        files.push(new File([blob], photo.name || 'photo.jpg', { type: blob.type || photo.mimeType || 'image/jpeg' }));
      } catch {
        // Skip a file the phone cannot read and share the rest.
      }
    }
    try {
      if (files.length > 0 && navigator.canShare?.({ files })) {
        await navigator.share({ files, title: name });
        return;
      }
      const links = chosen.map((photo) => photo.url).filter((url): url is string => Boolean(url)).join('\n');
      if (navigator.share) await navigator.share({ title: name, text: links });
      else await navigator.clipboard.writeText(links);
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === 'AbortError') return;
      setError(t('saveFailed'));
    }
  };

  const saveSelected = async () => {
    const chosen = chosenPhotos().filter((photo) => photo.url);
    for (const photo of chosen) {
      try {
        const response = await fetch(photo.url as string);
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = photo.name || 'photo.jpg';
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      } catch {
        setError(t('saveFailed'));
      }
    }
    setSheet(null);
  };

  const documentSelected = () => {
    const chosen = chosenPhotos().filter((photo) => photo.url);
    const win = window.open('', '_blank', 'noopener,noreferrer');
    if (!win) return;
    win.document.title = name;
    win.document.body.style.margin = '24px';
    const heading = win.document.createElement('h1');
    heading.textContent = name;
    win.document.body.append(heading);
    for (const photo of chosen) {
      if (photo.mimeType.startsWith('video/')) {
        const video = win.document.createElement('video');
        video.src = photo.url as string;
        video.controls = true;
        video.style.maxWidth = '100%';
        video.style.display = 'block';
        video.style.margin = '16px auto';
        win.document.body.append(video);
        continue;
      }
      const image = win.document.createElement('img');
      image.src = photo.url as string;
      image.alt = '';
      image.style.maxWidth = '100%';
      image.style.display = 'block';
      image.style.margin = '16px auto';
      win.document.body.append(image);
    }
    window.setTimeout(() => {
      win.focus();
      win.print();
    }, 400);
    setSheet(null);
  };

  const openMove = async () => {
    setSheet('move');
    const response = await fetch('/api/crm/projects?pageSize=100', { credentials: 'include' });
    const body = (await response.json()) as { projects?: { id: string; name: string }[]; error?: string };
    if (!response.ok) {
      setError(body.error || t('loadFailed'));
      return;
    }
    setProjects((body.projects ?? []).filter((row) => row.id !== projectId));
  };

  if (!open || typeof document === 'undefined') return null;

  if (pickerOpen && businessId) {
    return (
      <ProDrivePicker
        isOpen
        zIndex={500}
        onClose={() => setPickerOpen(false)}
        ownerType="business"
        ownerId={businessId}
        onSelect={(file) => {
          setPickerOpen(false);
          void addFromDrive(file);
        }}
      />
    );
  }

  const viewing = photos.find((photo) => photo.id === viewingId) ?? null;
  const tagOptions = [...new Set(photos.flatMap((photo) => photo.tags))].sort();
  const visiblePhotos = photos
    .filter((photo) => !photo.hidden)
    .filter((photo) => kind === 'all' || (kind === 'video' ? photo.mimeType.startsWith('video/') : !photo.mimeType.startsWith('video/')))
    .filter((photo) => !tag || photo.tags.includes(tag))
    .sort((a, b) => sort === 'newest'
      ? b.takenAt.localeCompare(a.takenAt)
      : a.takenAt.localeCompare(b.takenAt));
  const hiddenPhotos = photos.filter((photo) => photo.hidden);
  const cover = visiblePhotos.find((photo) => photo.isCover && photo.url)
    ?? visiblePhotos.find((photo) => photo.url && !photo.mimeType.startsWith('video/'))
    ?? visiblePhotos.find((photo) => photo.url);
  const groups: { key: string; label: string; photos: JobPhoto[] }[] = [];
  const now = new Date();
  for (const photo of visiblePhotos) {
    const key = dayKey(photo.takenAt);
    const existing = groups.find((group) => group.key === key);
    if (existing) {
      existing.photos.push(photo);
      continue;
    }
    const formatted = new Date(photo.takenAt).toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    groups.push({
      key,
      label: isSameDay(photo.takenAt, now) ? `${t('today')} · ${formatted}` : formatted,
      photos: [photo],
    });
  }

  return createPortal(
    <div className="fixed inset-0 bg-white text-black" style={{ zIndex: 300 }}>
      <div className="mx-auto flex h-full max-w-lg flex-col">
        <div className="flex items-center px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={onBack}
            className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-black"
            aria-label={t('customers')}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          {cover?.url ? (
            cover.mimeType.startsWith('video/') ? (
              <video src={cover.url} muted playsInline className="mx-auto h-20 w-20 rounded-2xl bg-black object-cover" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cover.url} alt="" className="mx-auto h-20 w-20 rounded-2xl object-cover" />
            )
          ) : (
            <div className="mx-auto h-20 w-20 rounded-2xl border-2 border-black bg-gray-100" />
          )}
          <h1 className="mt-3 text-center text-2xl font-bold">{name}</h1>
          {address ? <p className="mt-1 text-center text-sm text-gray-600">{address}</p> : null}

          <div className="mb-3 mt-6 flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold">{t('photoCount', { count: visiblePhotos.length })}</h2>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => { setSelecting((on) => !on); setSelectedIds([]); }} className={`flex h-10 w-10 items-center justify-center rounded-xl border-2 ${selecting ? 'border-black bg-black text-white' : 'border-black'}`} aria-label={t('selectPhotos')}>
                <Check className="h-5 w-5" />
              </button>
              <button type="button" onClick={() => setSheet('filter')} className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-black" aria-label={t('filterPhotos')}>
                <SlidersHorizontal className="h-5 w-5" />
              </button>
              <button type="button" onClick={() => setSheet('add')} className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-black" aria-label={t('addPhoto')}>
                <Plus className="h-5 w-5" />
              </button>
            </div>
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {loading ? <p className="text-sm">{t('loadingPhotos')}</p> : null}
          {!loading && visiblePhotos.length === 0 ? <p className="text-sm">{t('empty')}</p> : null}

          {groups.map((group) => (
            <section key={group.key} className="mb-4">
              <p className="mb-2 text-sm text-gray-600">{group.label}</p>
              <div className="grid grid-cols-3 gap-1">
                {group.photos.map((photo) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => {
                      if (!photo.url) return;
                      if (selecting) {
                        setSelectedIds((current) => current.includes(photo.id) ? current.filter((id) => id !== photo.id) : [...current, photo.id]);
                        return;
                      }
                      setViewingId(photo.id);
                    }}
                    className="relative aspect-square overflow-hidden rounded-xl bg-gray-200"
                  >
                    {selecting ? (
                      <span className={`absolute left-1 top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white ${selectedIds.includes(photo.id) ? 'bg-black text-white' : 'bg-black/30'}`}>
                        {selectedIds.includes(photo.id) ? <Check className="h-4 w-4" /> : null}
                      </span>
                    ) : null}
                    {photo.url && photo.mimeType.startsWith('video/') ? (
                      <video src={photo.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                    ) : photo.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo.url} alt="" className="h-full w-full object-cover" />
                    ) : null}
                    {photo.mimeType.startsWith('video/') ? (
                      <Video className="absolute bottom-1 left-1 h-4 w-4 text-white drop-shadow" aria-hidden />
                    ) : null}
                  </button>
                ))}
              </div>
            </section>
          ))}
          {hiddenPhotos.length > 0 ? (
            <section className="mb-4">
              <p className="mb-2 text-sm text-gray-600">{t('hiddenPhotos', { count: hiddenPhotos.length })}</p>
              <div className="grid grid-cols-3 gap-1">
                {hiddenPhotos.map((photo) => (
                  <button key={photo.id} type="button" onClick={() => photo.url && setViewingId(photo.id)} className="relative aspect-square overflow-hidden rounded-xl bg-gray-200 opacity-60">
                    {photo.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo.url} alt="" className="h-full w-full object-cover" />
                    ) : null}
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        {selectedIds.length > 0 ? (
          <div className="px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
            <div className="flex items-center justify-between rounded-full border-2 border-black bg-black px-2 py-2 text-white">
              <button type="button" onClick={() => { setSelectedIds([]); setSelecting(false); }} className="flex items-center gap-2 rounded-full px-3 py-2" aria-label={t('closePhoto')}>
                <X className="h-5 w-5" />
                <span className="font-bold">{selectedIds.length}</span>
              </button>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => void shareSelected()} className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-black" aria-label={t('shareGallery')}>
                  <Share2 className="h-5 w-5" />
                </button>
                <button type="button" onClick={() => setSheet('actions')} className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-black" aria-label={t('menu')}>
                  <MoreHorizontal className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        ) : (
        <div className="flex justify-center border-t-2 border-black py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onCamera}
            aria-label={t('openCamera')}
            className="flex items-center justify-center rounded-xl border-2 border-black bg-black text-white"
            style={{ width: 72, height: 72 }}
          >
            <Camera className="h-7 w-7" />
          </button>
        </div>
        )}
      </div>

      {sheet ? (
        <div className="absolute inset-0 z-10 flex flex-col justify-end bg-black/40">
          <button type="button" className="min-h-0 flex-1" aria-label={t('closePhoto')} onClick={() => setSheet(null)} />
          <div className="mx-auto max-h-[80%] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-gray-300" aria-hidden />
            {sheet === 'filter' ? (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <button type="button" onClick={() => setSheet(null)} aria-label={t('closePhoto')}><X className="h-5 w-5" /></button>
                  <h2 className="text-lg font-bold">{t('filterPhotos')}</h2>
                  <span className="w-5" />
                </div>
                <p className="mb-2 text-sm font-bold">{t('sort')}</p>
                <button type="button" onClick={() => { setSort('newest'); setSheet(null); }} className="flex w-full items-center gap-3 py-3 text-left">
                  <span className={`h-5 w-5 rounded border-2 border-black ${sort === 'newest' ? 'bg-black' : ''}`} />
                  {t('newestFirst')}
                </button>
                <button type="button" onClick={() => { setSort('oldest'); setSheet(null); }} className="flex w-full items-center gap-3 border-t border-gray-200 py-3 text-left">
                  <span className={`h-5 w-5 rounded border-2 border-black ${sort === 'oldest' ? 'bg-black' : ''}`} />
                  {t('oldestFirst')}
                </button>
                <p className="mb-2 mt-4 text-sm font-bold">{t('photoType')}</p>
                {(['all', 'photo', 'video'] as const).map((value) => (
                  <button key={value} type="button" onClick={() => { setKind(value); setSheet(null); }} className="flex w-full items-center gap-3 py-2 text-left">
                    <span className={`h-5 w-5 rounded-full border-2 border-black ${kind === value ? 'bg-black' : ''}`} />
                    {value === 'all' ? t('allTypes') : value === 'photo' ? t('photosOnly') : t('videosOnly')}
                  </button>
                ))}
                {tagOptions.length > 0 ? (
                  <>
                    <p className="mb-2 mt-4 text-sm font-bold">{t('tag')}</p>
                    <button type="button" onClick={() => { setTag(null); setSheet(null); }} className="mr-2 mb-2 rounded-full border-2 border-black px-3 py-1 text-sm">{t('allTypes')}</button>
                    {tagOptions.map((option) => (
                      <button key={option} type="button" onClick={() => { setTag(tag === option ? null : option); setSheet(null); }} className={`mr-2 mb-2 rounded-full border-2 px-3 py-1 text-sm ${tag === option ? 'border-black bg-black text-white' : 'border-black'}`}>{option}</button>
                    ))}
                  </>
                ) : null}
              </>
            ) : sheet === 'actions' ? (
              <div className="flex flex-col">
                {([
                  { icon: Tag, label: t('tag'), run: () => setSheet('bulkTags') },
                  { icon: Share2, label: t('shareGallery'), run: () => void shareSelected() },
                  { icon: EyeOff, label: t('hidePhoto'), run: () => void patchSelected(() => ({ hidden: true })) },
                  { icon: FolderInput, label: t('moveToProject'), run: () => void openMove() },
                  { icon: Download, label: t('saveToDevice'), run: () => void saveSelected() },
                  { icon: FileText, label: t('document'), run: () => documentSelected() },
                  { icon: Trash2, label: t('trash'), run: () => void patchSelected(() => ({ trash: true })) },
                ] as const).map((item) => (
                  <button key={item.label} type="button" disabled={working} onClick={item.run} className="flex w-full items-center gap-4 py-3 text-left text-base disabled:opacity-40">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-black">
                      <item.icon className="h-5 w-5" />
                    </span>
                    {item.label}
                  </button>
                ))}
              </div>
            ) : sheet === 'move' ? (
              <div>
                <h2 className="mb-3 text-lg font-bold">{t('moveToProject')}</h2>
                {projects.length === 0 ? <p className="text-sm">{t('empty')}</p> : null}
                {projects.map((project) => (
                  <button key={project.id} type="button" disabled={working} onClick={() => void patchSelected(() => ({ moveToProjectId: project.id }))} className="block w-full border-t border-gray-200 py-3 text-left disabled:opacity-40">
                    {project.name}
                  </button>
                ))}
              </div>
            ) : sheet === 'bulkTags' ? (
              <div>
                <h2 className="mb-3 text-lg font-bold">{t('applyTags')}</h2>
                <div className="flex flex-wrap gap-2">
                  {BULK_TAGS.map((option) => (
                    <button key={option} type="button" disabled={working} onClick={() => void patchSelected((photo) => ({ tags: [...new Set([...photo.tags, option])] }))} className="rounded-full border-2 border-black px-3 py-1 text-sm disabled:opacity-40">
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <button type="button" disabled={uploading} onClick={() => uploadRef.current?.click()} className="flex w-full items-center gap-3 py-3 text-left font-medium">
                  <Upload className="h-5 w-5" />
                  {t('uploadPhotos')}
                </button>
                <button
                  type="button"
                  disabled={uploading || !businessId}
                  onClick={() => {
                    setSheet(null);
                    setPickerOpen(true);
                  }}
                  className="flex w-full items-center gap-3 py-3 text-left font-medium disabled:opacity-40"
                >
                  <HardDrive className="h-5 w-5" />
                  {t('fromProDrive')}
                </button>
                <button type="button" onClick={() => {
                  const before = selectedIds.length === 1 ? selectedIds[0] : null;
                  setSheet(null);
                  if (before) onTakeAfter(before);
                  else {
                    setSelecting(true);
                    setError(t('selectBefore'));
                  }
                }} className="flex w-full items-center gap-3 py-3 text-left font-medium">
                  <ImagePlus className="h-5 w-5" />
                  {t('beforeAfter')}
                </button>
                <button type="button" onClick={() => { setSheet(null); onWalkthrough(); }} className="flex w-full items-center gap-3 py-3 text-left font-medium">
                  <Video className="h-5 w-5" />
                  {t('walkthrough')}
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
      <input
        ref={uploadRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          event.target.value = '';
          if (files.length === 0) return;
          setUploading(true);
          setSheet(null);
          void onUpload(files).then(() => setRefresh((value) => value + 1)).catch((uploadError: unknown) => {
            setError(uploadError instanceof Error ? uploadError.message : t('saveFailed'));
          }).finally(() => setUploading(false));
        }}
      />

      {viewing ? (
        <JobPhotoViewer
          photo={viewing}
          photos={photos}
          projectId={projectId}
          projectName={name}
          customerId={customerId}
          customerName={name}
          address={address}
          onClose={() => setViewingId(null)}
          onChanged={() => {
            void fetch(`/api/crm/projects/${projectId}/photos`, { credentials: 'include' })
              .then((response) => response.json())
              .then((body: { photos?: JobPhoto[] }) => {
                if (!Array.isArray(body.photos)) return;
                setPhotos(body.photos.map((photo) => ({
                  id: photo.id,
                  caption: photo.caption,
                  takenAt: photo.takenAt,
                  name: photo.name,
                  mimeType: photo.mimeType ?? '',
                  url: photo.url,
                  tags: photo.tags ?? [],
                  latitude: photo.latitude ?? null,
                  longitude: photo.longitude ?? null,
                  accuracyM: photo.accuracyM ?? null,
                  headingDeg: photo.headingDeg ?? null,
                  hidden: Boolean(photo.hidden),
                  isCover: Boolean(photo.isCover),
                  pairedPhotoId: photo.pairedPhotoId ?? null,
                })));
              });
          }}
          onTakeAfter={(photoId) => {
            setViewingId(null);
            onTakeAfter(photoId);
          }}
        />
      ) : null}
    </div>,
    document.body
  );
}
