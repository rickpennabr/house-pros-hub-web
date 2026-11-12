'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, HardDrive, ImagePlus, SwitchCamera, Video, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ProDrivePicker } from '@/components/drive/ProDrivePicker';
import type { DriveFile } from '@/lib/drive/types';

interface Shot {
  id: string;
  file: File;
  url: string;
  caption: string;
  video: boolean;
}

interface JobCameraSessionProps {
  open: boolean;
  title: string;
  subtitle?: string;
  projectId?: string;
  onBack: () => void;
  onFinished: () => void;
  onSave: (items: { file: File; caption: string }[]) => Promise<void>;
}

function captureFile(file: File, video: boolean): File {
  if (!video) {
    if (file.type.startsWith('image/')) return file;
    return new File([file], file.name || `job-${Date.now()}.jpg`, { type: 'image/jpeg' });
  }
  const lower = file.name.toLowerCase();
  const type = file.type === 'video/quicktime' || lower.endsWith('.mov')
    ? 'video/quicktime'
    : file.type === 'video/webm' || lower.endsWith('.webm')
      ? 'video/webm'
      : 'video/mp4';
  const ext = type === 'video/quicktime' ? 'mov' : type === 'video/webm' ? 'webm' : 'mp4';
  return new File([file], file.name || `job-${Date.now()}.${ext}`, { type });
}

/**
 * Full-screen job camera. A secure page shows a live viewfinder.
 * A phone on plain http uses the system camera, then keeps the shots here until Done.
 */
export function JobCameraSession({ open, title, subtitle, projectId, onBack, onFinished, onSave }: JobCameraSessionProps) {
  const t = useTranslations('jobsite');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const facingRef = useRef<'environment' | 'user'>('environment');
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const captionRef = useRef<HTMLTextAreaElement>(null);
  const shotsRef = useRef<Shot[]>([]);
  const draftRef = useRef<Shot | null>(null);
  const [live, setLive] = useState(false);
  const [shots, setShots] = useState<Shot[]>([]);
  const [draft, setDraft] = useState<Shot | null>(null);
  const [caption, setCaption] = useState('');
  shotsRef.current = shots;
  draftRef.current = draft;
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [added, setAdded] = useState(false);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setLive(false);
  };

  const startLive = async (facing: 'environment' | 'user') => {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) return;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing } },
        audio: false,
      });
      facingRef.current = facing;
      streamRef.current = stream;
      setLive(true);
    } catch {
      setLive(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setSaved(false);
    setError(null);
    setDraft((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
    setCaption('');
    setShots((current) => {
      current.forEach((shot) => URL.revokeObjectURL(shot.url));
      return [];
    });
    void startLive('environment');
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!live || !video || !stream) return;
    video.srcObject = stream;
    void video.play().catch(() => undefined);
  }, [live]);

  useEffect(() => {
    return () => {
      shotsRef.current.forEach((shot) => URL.revokeObjectURL(shot.url));
      if (draftRef.current) URL.revokeObjectURL(draftRef.current.url);
    };
  }, []);

  useEffect(() => {
    if (!open || !projectId) return;
    let cancelled = false;
    void fetch(`/api/crm/projects/${projectId}/photos`, { credentials: 'include' })
      .then((response) => response.json())
      .then((body: { businessId?: string | null }) => {
        if (!cancelled) setBusinessId(body.businessId ?? null);
      })
      .catch(() => {
        if (!cancelled) setBusinessId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, projectId]);

  const openDraft = (file: File, video: boolean) => {
    const ready = captureFile(file, video);
    const next = {
      id: `${ready.name}-${ready.size}-${Date.now()}`,
      file: ready,
      url: URL.createObjectURL(ready),
      caption: '',
      video,
    };
    setDraft((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return next;
    });
    setCaption('');
    setSaved(false);
    window.setTimeout(() => captionRef.current?.focus(), 50);
  };

  const keepDraft = () => {
    if (!draft) return;
    setShots((current) => [...current, { ...draft, caption: caption.trim() }]);
    setDraft(null);
    setCaption('');
  };

  const addLibrary = (files: File[]) => {
    const images = files.filter((file) => !file.type.startsWith('video/'));
    if (images.length === 1 && files.length === 1) {
      openDraft(images[0], false);
      return;
    }
    const next = images.map((file) => {
      const ready = captureFile(file, false);
      return {
        id: `${ready.name}-${ready.size}-${Date.now()}-${Math.random()}`,
        file: ready,
        url: URL.createObjectURL(ready),
        caption: '',
        video: false,
      };
    });
    if (next.length === 0) return;
    setShots((current) => [...current, ...next]);
    setSaved(false);
  };

  const snapLive = () => {
    const video = videoRef.current;
    if (!video || saving) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      openDraft(new File([blob], `job-${Date.now()}.jpg`, { type: 'image/jpeg' }), false);
    }, 'image/jpeg', 0.9);
  };

  const finish = async () => {
    if (shots.length === 0 || saving) {
      onBack();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(shots.map((shot) => ({ file: shot.file, caption: shot.caption })));
      stopStream();
      setSaved(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const addFromDrive = async (file: DriveFile) => {
    if (!projectId) return;
    if (!file.mimeType.startsWith('image/') && !file.mimeType.startsWith('video/')) {
      setError(t('drivePhotoOnly'));
      return;
    }
    setSaving(true);
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
      setAdded(true);
      window.setTimeout(() => setAdded(false), 3000);
    } catch (linkError) {
      setError(linkError instanceof Error ? linkError.message : t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (!open || typeof document === 'undefined') return null;

  const lastShot = shots[shots.length - 1];

  return createPortal(
    <div className="fixed inset-0 z-[120] flex flex-col bg-black text-white">
      <div className="flex items-center gap-3 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={() => {
            if (saved) onFinished();
            else if (draft) {
              URL.revokeObjectURL(draft.url);
              setDraft(null);
              setCaption('');
            } else onBack();
          }}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15"
          aria-label={t('back')}
        >
          <X className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate font-bold">{title}</p>
          {subtitle ? <p className="truncate text-xs text-white/70">{subtitle}</p> : null}
        </div>
        {live ? (
          <button
            type="button"
            onClick={() => void startLive(facingRef.current === 'environment' ? 'user' : 'environment')}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15"
            aria-label={t('flipCamera')}
          >
            <SwitchCamera className="h-5 w-5" />
          </button>
        ) : (
          <span className="h-10 w-10" />
        )}
      </div>

      <div className="relative min-h-0 flex-1 bg-black">
        {live ? (
          <video ref={videoRef} className={draft ? 'hidden' : 'h-full w-full object-cover'} playsInline muted autoPlay />
        ) : null}
        {draft ? (
          draft.video ? (
            <video src={draft.url} controls playsInline className="h-full w-full object-contain" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={draft.url} alt="" className="h-full w-full object-contain" />
          )
        ) : !live ? (
          <div className="flex h-full items-center justify-center px-8 text-center text-sm text-white/70">
            {t('shutterHint')}
          </div>
        ) : null}
        {error ? <p className="absolute inset-x-4 top-4 rounded-lg bg-red-600 px-3 py-2 text-sm">{error}</p> : null}
      </div>

      {saved ? (
        <div className="rounded-t-3xl bg-white px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 text-black">
          <p className="text-center text-sm text-gray-600">{t('savedCount', { count: shots.length })}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {shots.map((shot) => shot.video ? (
              <video key={shot.id} src={shot.url} muted playsInline className="h-16 w-16 rounded-lg bg-black object-cover" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={shot.id} src={shot.url} alt="" className="h-16 w-16 rounded-lg object-cover" />
            ))}
          </div>
          <button
            type="button"
            onClick={onFinished}
            className="mt-5 w-full rounded-full bg-black py-3 font-medium text-white"
          >
            {t('done')}
          </button>
        </div>
      ) : draft ? (
        <div className="bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 text-black">
          <textarea
            ref={captionRef}
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            placeholder={t('descriptionPlaceholder')}
            maxLength={500}
            rows={3}
            className="w-full rounded-lg border-2 border-black px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={keepDraft}
            className="mt-3 w-full rounded-full bg-black py-3 font-medium text-white"
          >
            {t('nextPhoto')}
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            disabled={saving}
            className="flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/15 disabled:opacity-50"
            style={{ width: 48, height: 48 }}
            aria-label={t('photosFromLibrary')}
          >
            {lastShot && !lastShot.video ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={lastShot.url} alt="" className="h-full w-full object-cover" />
            ) : lastShot?.video ? (
              <Video className="h-5 w-5" />
            ) : (
              <ImagePlus className="h-5 w-5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              if (live) snapLive();
              else cameraInputRef.current?.click();
            }}
            disabled={saving}
            aria-label={t('shutter')}
            className="flex shrink-0 items-center justify-center rounded-full border-4 border-white disabled:opacity-50"
            style={{ width: 76, height: 76 }}
          >
            <span className="block rounded-full bg-white" style={{ width: 60, height: 60 }} />
          </button>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <button
              type="button"
              onClick={() => videoInputRef.current?.click()}
              disabled={saving}
              className="flex items-center gap-1 rounded-full bg-white/15 px-3 py-2 text-xs font-bold disabled:opacity-50"
            >
              <Video className="h-4 w-4" />
              {t('video')}
            </button>
            <button
              type="button"
              onClick={() => void finish()}
              disabled={saving || shots.length === 0}
              className="rounded-full bg-white px-4 py-2 text-sm font-bold text-black disabled:opacity-40"
            >
              {saving ? t('saving') : t('done')}
            </button>
          </div>
        </div>
      )}

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) openDraft(file, false);
        }}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) openDraft(file, true);
        }}
      />
      {added ? (
        <p className="absolute inset-x-4 bottom-28 z-20 flex items-center gap-2 rounded-lg bg-green-600 px-3 py-3 text-sm font-bold text-white">
          <Check className="h-5 w-5" />
          {t('photoAdded')}
        </p>
      ) : null}
      {addOpen ? (
        <div className="absolute inset-0 z-20 flex flex-col justify-end bg-black/40">
          <button type="button" className="min-h-0 flex-1" aria-label={t('closePhoto')} onClick={() => setAddOpen(false)} />
          <div className="rounded-t-3xl bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 text-black">
            <button
              type="button"
              onClick={() => {
                setAddOpen(false);
                libraryInputRef.current?.click();
              }}
              className="flex w-full items-center gap-3 py-3 text-left font-medium"
            >
              <ImagePlus className="h-5 w-5" />
              {t('photoLibrary')}
            </button>
            <button
              type="button"
              disabled={!businessId}
              onClick={() => {
                setAddOpen(false);
                setPickerOpen(true);
              }}
              className="flex w-full items-center gap-3 py-3 text-left font-medium disabled:opacity-40"
            >
              <HardDrive className="h-5 w-5" />
              {t('fromProDrive')}
            </button>
          </div>
        </div>
      ) : null}
      {pickerOpen && businessId && projectId ? (
        <ProDrivePicker
          isOpen
          zIndex={500}
          ownerType="business"
          ownerId={businessId}
          onClose={() => setPickerOpen(false)}
          onSelect={(file) => {
            void addFromDrive(file);
          }}
        />
      ) : null}
      <input
        ref={libraryInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          event.target.value = '';
          addLibrary(files);
        }}
      />
    </div>,
    document.body
  );
}
