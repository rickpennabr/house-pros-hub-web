'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, HardDrive, ImagePlus, Square, SwitchCamera, Video, X } from 'lucide-react';
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
  /** Job is the contractor camera. Fix is the same camera for a repair, without video or ProDrive. */
  mode?: 'job' | 'fix';
  title: string;
  subtitle?: string;
  projectId?: string;
  /** Walkthrough opens straight into recording. Photo is the shutter. */
  begin?: 'photo' | 'video';
  /** Fix stops at the photos already allowed. Job has no cap. */
  maxShots?: number;
  onBack: () => void;
  /** Fix only: open the repair form without taking a photo. */
  onSkip?: () => void;
  onFinished: () => void;
  onSave: (items: { file: File; caption: string }[]) => Promise<void>;
}

function captureFile(file: File, video: boolean, prefix: string): File {
  if (!video) {
    if (file.type.startsWith('image/')) return file;
    return new File([file], file.name || `${prefix}-${Date.now()}.jpg`, { type: 'image/jpeg' });
  }
  const lower = file.name.toLowerCase();
  const type = file.type === 'video/quicktime' || lower.endsWith('.mov')
    ? 'video/quicktime'
    : file.type === 'video/webm' || lower.endsWith('.webm')
      ? 'video/webm'
      : 'video/mp4';
  const ext = type === 'video/quicktime' ? 'mov' : type === 'video/webm' ? 'webm' : 'mp4';
  return new File([file], file.name || `${prefix}-${Date.now()}.${ext}`, { type });
}

function recorderChoice(): { mime: string; ext: string } {
  const options = [
    { mime: 'video/webm;codecs=vp8,opus', ext: 'webm' },
    { mime: 'video/webm', ext: 'webm' },
    { mime: 'video/mp4', ext: 'mp4' },
  ];
  if (typeof MediaRecorder === 'undefined') return { mime: '', ext: 'webm' };
  return options.find((option) => MediaRecorder.isTypeSupported(option.mime)) ?? { mime: '', ext: 'webm' };
}

/**
 * Shared ProCam frame for Job and Fix.
 * The stage is the full screen. The live preview shows the whole sensor frame (object-contain, 4:3),
 * so the photo you keep matches what you framed. The shutter stays centered.
 * Job adds video, captions, and ProDrive. Fix keeps the same shutter and stops at a few photos.
 */
export function JobCameraSession({
  open,
  mode = 'job',
  title,
  subtitle,
  projectId,
  begin = 'photo',
  maxShots,
  onBack,
  onSkip,
  onFinished,
  onSave,
}: JobCameraSessionProps) {
  const t = useTranslations('jobsite');
  const fix = useTranslations('procam');
  const isFix = mode === 'fix';
  const prefix = isFix ? 'procam' : 'job';
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
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<MediaStream | null>(null);
  const discardRecording = useRef(false);
  const sessionRef = useRef(0);
  const recordRef = useRef<() => void>(() => undefined);
  const walkthroughStarted = useRef(false);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setLive(false);
  };

  const startLive = async (facing: 'environment' | 'user') => {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) return;
    const previous = streamRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          aspectRatio: { ideal: 4 / 3 },
          width: { ideal: 1920 },
          height: { ideal: 1440 },
        },
        audio: false,
      });
      previous?.getTracks().forEach((track) => track.stop());
      facingRef.current = facing;
      streamRef.current = stream;
      setLive(true);
    } catch {
      if (previous?.getVideoTracks().some((track) => track.readyState === 'live')) {
        streamRef.current = previous;
        setLive(true);
        return;
      }
      setLive(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setSaved(false);
    setError(maxShots === 0 ? fix('maxPhotos') : null);
    setDraft((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
    setCaption('');
    setRecording(false);
    setElapsed(0);
    setShots((current) => {
      current.forEach((shot) => URL.revokeObjectURL(shot.url));
      return [];
    });
    void startLive('environment');
    return () => {
      sessionRef.current += 1;
      discardRecording.current = true;
      if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
      audioRef.current?.getTracks().forEach((track) => track.stop());
      audioRef.current = null;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    if (!recording) return;
    const id = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(id);
  }, [recording]);

  useEffect(() => {
    if (!open) {
      walkthroughStarted.current = false;
      return;
    }
    if (begin !== 'video' || !live || isFix || walkthroughStarted.current) return;
    walkthroughStarted.current = true;
    recordRef.current();
  }, [open, begin, live, isFix]);

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

  const roomLeft = () => (maxShots == null ? Number.POSITIVE_INFINITY : maxShots - shotsRef.current.length);

  const openDraft = (file: File, video: boolean) => {
    if (roomLeft() <= 0) {
      setError(fix('maxPhotos'));
      return;
    }
    const ready = captureFile(file, video, prefix);
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
    if (!isFix) window.setTimeout(() => captionRef.current?.focus(), 50);
  };

  const keepDraft = () => {
    if (!draft) return;
    setShots((current) => [...current, { ...draft, caption: caption.trim() }]);
    setDraft(null);
    setCaption('');
  };

  const addLibrary = (files: File[]) => {
    const room = roomLeft();
    if (room <= 0) {
      setError(fix('maxPhotos'));
      return;
    }
    const usable = files.filter((file) => file.type.startsWith('image/') || (!isFix && file.type.startsWith('video/')));
    const take = usable.slice(0, room);
    if (usable.length > take.length) setError(fix('maxPhotos'));
    if (take.length === 1) {
      openDraft(take[0], take[0].type.startsWith('video/'));
      return;
    }
    const next = take.map((file) => {
      const video = file.type.startsWith('video/');
      const ready = captureFile(file, video, prefix);
      return {
        id: `${ready.name}-${ready.size}-${Date.now()}-${Math.random()}`,
        file: ready,
        url: URL.createObjectURL(ready),
        caption: '',
        video,
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
      openDraft(new File([blob], `${prefix}-${Date.now()}.jpg`, { type: 'image/jpeg' }), false);
    }, 'image/jpeg', 0.9);
  };

  const startRecording = async () => {
    if (isFix || saving) return;
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop();
      return;
    }
    const videoStream = streamRef.current;
    if (!live || !videoStream || typeof MediaRecorder === 'undefined') {
      videoInputRef.current?.click();
      return;
    }
    const chosen = recorderChoice();
    let mixed: MediaStream = videoStream;
    try {
      const audio = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      audioRef.current = audio;
      mixed = new MediaStream([...videoStream.getVideoTracks(), ...audio.getAudioTracks()]);
    } catch {
      audioRef.current = null;
    }
    let recorder: MediaRecorder;
    try {
      recorder = chosen.mime
        ? new MediaRecorder(mixed, { mimeType: chosen.mime, videoBitsPerSecond: 800_000 })
        : new MediaRecorder(mixed);
    } catch {
      audioRef.current?.getTracks().forEach((track) => track.stop());
      audioRef.current = null;
      videoInputRef.current?.click();
      return;
    }
    const chunks: Blob[] = [];
    const session = sessionRef.current;
    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = () => {
      audioRef.current?.getTracks().forEach((track) => track.stop());
      audioRef.current = null;
      recorderRef.current = null;
      if (discardRecording.current || session !== sessionRef.current) return;
      setRecording(false);
      const type = (recorder.mimeType || chosen.mime || 'video/webm').split(';')[0];
      const ext = type.includes('mp4') ? 'mp4' : 'webm';
      const blob = new Blob(chunks, { type });
      if (blob.size === 0) return;
      openDraft(new File([blob], `${prefix}-${Date.now()}.${ext}`, { type }), true);
    };
    discardRecording.current = false;
    recorder.start(1000);
    setElapsed(0);
    setRecording(true);
    window.setTimeout(() => {
      if (recorder.state === 'recording') recorder.stop();
    }, 120_000);
  };
  recordRef.current = () => {
    void startRecording();
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
    <div className="fixed inset-0 z-[120] flex h-[100dvh] max-h-[100dvh] flex-col bg-black text-white">
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
            disabled={recording}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 disabled:opacity-40"
            aria-label={t('flipCamera')}
          >
            <SwitchCamera className="h-5 w-5" />
          </button>
        ) : (
          <span className="h-10 w-10" />
        )}
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
        {live ? (
          <video ref={videoRef} className={draft ? 'hidden' : 'absolute inset-0 h-full w-full object-contain'} playsInline muted autoPlay />
        ) : null}
        {draft ? (
          draft.video ? (
            <video src={draft.url} controls playsInline className="absolute inset-0 h-full w-full object-contain" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={draft.url} alt="" className="absolute inset-0 h-full w-full object-contain" />
          )
        ) : !live ? (
          <div className="absolute inset-0 flex items-center justify-center px-8 text-center text-sm text-white/70">
            {isFix ? fix('captureHint') : t('shutterHint')}
          </div>
        ) : null}
        {recording ? (
          <p className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-full bg-red-600 px-3 py-1 text-sm font-bold">
            <span className="h-2 w-2 rounded-full bg-white" />
            {`${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`}
          </p>
        ) : null}
        {error ? <p className="absolute inset-x-4 top-14 rounded-lg bg-red-600 px-3 py-2 text-sm">{error}</p> : null}
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
          {isFix ? null : (
            <textarea
              ref={captionRef}
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              placeholder={t('descriptionPlaceholder')}
              maxLength={500}
              rows={3}
              className="w-full rounded-lg border-2 border-black px-3 py-2 text-sm"
            />
          )}
          <button
            type="button"
            onClick={keepDraft}
            className="mt-3 w-full rounded-full bg-black py-3 font-medium text-white"
          >
            {t('nextPhoto')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            disabled={saving || recording || (maxShots != null && shots.length >= maxShots)}
            className="flex shrink-0 items-center justify-center justify-self-start overflow-hidden rounded-lg bg-white/15 disabled:opacity-50"
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
            disabled={saving || recording || (maxShots != null && shots.length >= maxShots)}
            aria-label={t('shutter')}
            className="flex shrink-0 items-center justify-center rounded-full border-4 border-white disabled:opacity-50"
            style={{ width: 76, height: 76 }}
          >
            <span className="block rounded-full bg-white" style={{ width: 60, height: 60 }} />
          </button>
          <div className="flex shrink-0 flex-col items-end gap-2 justify-self-end">
            {isFix ? null : (
              <button
                type="button"
                onClick={() => void startRecording()}
                disabled={saving}
                className={`flex items-center gap-1 rounded-full px-3 py-2 text-xs font-bold disabled:opacity-50 ${recording ? 'bg-red-600 text-white' : 'bg-white/15'}`}
                aria-label={recording ? t('stopVideo') : t('video')}
              >
                {recording ? <Square className="h-4 w-4 fill-current" /> : <Video className="h-4 w-4" />}
                {recording ? t('stopVideo') : t('video')}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (isFix && shots.length === 0) onSkip?.();
                else void finish();
              }}
              disabled={saving || recording || (shots.length === 0 && !(isFix && onSkip))}
              className={isFix && shots.length === 0
                ? 'max-w-[7.5rem] rounded-full bg-white px-3 py-2 text-right text-xs font-bold leading-tight text-black disabled:opacity-40'
                : 'rounded-full bg-white px-4 py-2 text-sm font-bold text-black disabled:opacity-40'}
            >
              {saving ? t('saving') : isFix && shots.length === 0 ? fix('skipToUpload') : t('done')}
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
            {isFix ? null : (
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
            )}
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
            setPickerOpen(false);
            void addFromDrive(file);
          }}
        />
      ) : null}
      <input
        ref={libraryInputRef}
        type="file"
        accept={isFix ? 'image/*' : 'image/*,video/*'}
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
