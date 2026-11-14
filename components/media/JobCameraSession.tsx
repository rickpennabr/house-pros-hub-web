'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Check, HardDrive, ImagePlus, Pause, Play, SwitchCamera, Video, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ProDrivePicker } from '@/components/drive/ProDrivePicker';
import { RepairCameraMark } from '@/components/pageslayout/PagesMenu';
import type { DriveFile } from '@/lib/drive/types';
import { canUseLiveCamera, clearPrimedCamera, liveCameraConstraints, readPrimedCamera, releasePrimedCamera, widenDesktopTrack } from '@/lib/media/prime-camera';
import { playCameraShutter, primeCameraShutter } from '@/lib/media/camera-shutter';
import { revealVideoDuration, webmWithDuration } from '@/lib/media/webm-duration';

interface Shot {
  id: string;
  file: File;
  url: string;
  caption: string;
  video: boolean;
  /** Wall-clock length. Chrome's player reports 0:00 for a fresh recording. */
  durationMs?: number;
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

/** The part of the sensor that object-cover is showing in the video element. */
function coverSource(video: HTMLVideoElement): { sx: number; sy: number; sw: number; sh: number } {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const box = video.getBoundingClientRect();
  if (!vw || !vh || !box.width || !box.height) {
    return { sx: 0, sy: 0, sw: vw || 1280, sh: vh || 720 };
  }
  const videoRatio = vw / vh;
  const boxRatio = box.width / box.height;
  if (videoRatio > boxRatio) {
    const sw = vh * boxRatio;
    return { sx: (vw - sw) / 2, sy: 0, sw, sh: vh };
  }
  const sh = vw / boxRatio;
  return { sx: 0, sy: (vh - sh) / 2, sw: vw, sh };
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

function formatClock(seconds: number): string {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : 0;
  const minutes = Math.floor(total / 60);
  const remain = total % 60;
  return `${minutes}:${String(remain).padStart(2, '0')}`;
}

function RecordedPreview({ url, durationMs }: { url: string; durationMs?: number }) {
  const ref = useRef<HTMLVideoElement>(null);
  const known = durationMs && durationMs > 0 ? durationMs / 1000 : 0;
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [mediaDuration, setMediaDuration] = useState(0);
  const total = known || mediaDuration;

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const onTime = () => {
      if (known && node.currentTime > known + 0.5) return;
      setCurrent(node.currentTime);
    };
    const onMeta = () => {
      if (Number.isFinite(node.duration) && node.duration > 0) setMediaDuration(node.duration);
      else revealVideoDuration(node);
    };
    const onDuration = () => {
      if (Number.isFinite(node.duration) && node.duration > 0) setMediaDuration(node.duration);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    node.addEventListener('timeupdate', onTime);
    node.addEventListener('loadedmetadata', onMeta);
    node.addEventListener('durationchange', onDuration);
    node.addEventListener('play', onPlay);
    node.addEventListener('pause', onPause);
    node.addEventListener('ended', onPause);
    if (node.readyState >= 1) onMeta();
    return () => {
      node.removeEventListener('timeupdate', onTime);
      node.removeEventListener('loadedmetadata', onMeta);
      node.removeEventListener('durationchange', onDuration);
      node.removeEventListener('play', onPlay);
      node.removeEventListener('pause', onPause);
      node.removeEventListener('ended', onPause);
    };
  }, [url, known]);

  const toggle = () => {
    const node = ref.current;
    if (!node) return;
    if (node.paused) void node.play();
    else node.pause();
  };

  return (
    <>
      <video
        ref={ref}
        src={url}
        playsInline
        preload="auto"
        className="absolute inset-0 h-full w-full object-contain"
        onClick={toggle}
      />
      <div className="absolute inset-x-3 bottom-3 z-10 flex items-center gap-2 rounded-full bg-black/75 px-3 py-2 text-xs font-medium text-white">
        <button type="button" onClick={toggle} className="flex h-7 w-7 shrink-0 items-center justify-center" aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? <Pause className="h-4 w-4 fill-white" /> : <Play className="h-4 w-4 fill-white" />}
        </button>
        <span className="shrink-0 tabular-nums">{formatClock(current)}</span>
        <input
          type="range"
          min={0}
          max={total || 0}
          step={0.1}
          value={Math.min(current, total || 0)}
          onChange={(event) => {
            const node = ref.current;
            const next = Number(event.target.value);
            if (node) node.currentTime = next;
            setCurrent(next);
          }}
          className="h-1 min-w-0 flex-1 accent-white"
          aria-label={formatClock(total)}
          aria-valuemin={0}
          aria-valuemax={Math.round(total)}
          aria-valuenow={Math.round(Math.min(current, total || 0))}
          aria-valuetext={`${formatClock(current)} / ${formatClock(total)}`}
        />
        <span className="shrink-0 tabular-nums">{formatClock(total)}</span>
      </div>
    </>
  );
}

/**
 * Shared ProCam frame for Job and Fix.
 * Both fill the same bordered frame and save the crop you see.
 * The shutter stays centered. Video mode turns that center red.
 * Job still adds a caption and can pick from ProDrive. Fix stops at a few clips.
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
  const [captureMode, setCaptureMode] = useState<'photo' | 'video'>(begin === 'video' ? 'video' : 'photo');
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<MediaStream | null>(null);
  const discardRecording = useRef(false);
  const sessionRef = useRef(0);
  const startingRef = useRef<Promise<boolean> | null>(null);
  const liveRequest = useRef(0);
  const openWatch = useRef(0);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setLive(false);
  };

  const attachStream = (stream: MediaStream) => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    video.setAttribute('playsinline', 'true');
    video.setAttribute('webkit-playsinline', 'true');
    video.srcObject = stream;
    void video.play().catch(() => undefined);
  };

  const startLive = (facing: 'environment' | 'user', options?: { quiet?: boolean; fresh?: boolean }): Promise<boolean> => {
    if (startingRef.current && facingRef.current === facing) return startingRef.current;
    const generation = sessionRef.current;
    const requestId = liveRequest.current + 1;
    liveRequest.current = requestId;
    const run = (async (): Promise<boolean> => {
      if (!window.isSecureContext || !canUseLiveCamera()) {
        setError(fix('cameraUnavailable'));
        return false;
      }
      const previous = streamRef.current;
      if (options?.fresh) releasePrimedCamera();
      const primed = options?.fresh ? null : readPrimedCamera(facing);
      let stream: MediaStream | null = null;
      try {
        stream = primed
          ? await primed
          : await navigator.mediaDevices.getUserMedia(liveCameraConstraints(facing));
      } catch {
        stream = null;
      }
      if (requestId !== liveRequest.current || generation !== sessionRef.current) {
        const orphan = stream;
        queueMicrotask(() => {
          if (orphan && streamRef.current !== orphan) orphan.getTracks().forEach((track) => track.stop());
        });
        return false;
      }
      if (!stream) {
        if (previous?.getVideoTracks().some((track) => track.readyState === 'live')) {
          streamRef.current = previous;
          setLive(true);
          return true;
        }
        setLive(false);
        if (!options?.quiet) setError(fix('cameraDenied'));
        return false;
      }
      clearPrimedCamera();
      await widenDesktopTrack(stream.getVideoTracks()[0]);
      if (requestId !== liveRequest.current || generation !== sessionRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return false;
      }
      previous?.getTracks().forEach((track) => track.stop());
      facingRef.current = facing;
      streamRef.current = stream;
      attachStream(stream);
      setLive(true);
      setError((current) => (
        current === fix('cameraDenied') || current === fix('cameraUnavailable') ? null : current
      ));
      return true;
    })();
    startingRef.current = run;
    void run.finally(() => {
      if (startingRef.current === run) startingRef.current = null;
    });
    return run;
  };

  useEffect(() => {
    openWatch.current += 1;
    const watch = openWatch.current;
    if (!open) {
      sessionRef.current += 1;
      liveRequest.current += 1;
      startingRef.current = null;
      discardRecording.current = true;
      if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
      audioRef.current?.getTracks().forEach((track) => track.stop());
      audioRef.current = null;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      releasePrimedCamera();
      return;
    }
    setSaved(false);
    setError(maxShots === 0 ? fix('maxPhotos') : null);
    setDraft((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
    setCaption('');
    setRecording(false);
    setCaptureMode(begin === 'video' ? 'video' : 'photo');
    setElapsed(0);
    setShots((current) => {
      current.forEach((shot) => URL.revokeObjectURL(shot.url));
      return [];
    });
    void startLive('environment', { quiet: true });
    return () => {
      queueMicrotask(() => {
        if (openWatch.current !== watch) return;
        sessionRef.current += 1;
        liveRequest.current += 1;
        startingRef.current = null;
        discardRecording.current = true;
        if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
        audioRef.current?.getTracks().forEach((track) => track.stop());
        audioRef.current = null;
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        releasePrimedCamera();
      });
    };
  }, [open]);

  useEffect(() => {
    if (!recording) return;
    const id = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(id);
  }, [recording]);

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

  const openDraft = (file: File, video: boolean, durationMs?: number) => {
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
      durationMs,
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
    const usable = files.filter((file) => file.type.startsWith('image/') || file.type.startsWith('video/'));
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
    const crop = coverSource(video);
    canvas.width = Math.max(1, Math.round(crop.sw));
    canvas.height = Math.max(1, Math.round(crop.sh));
    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(video, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      openDraft(new File([blob], `${prefix}-${Date.now()}.jpg`, { type: 'image/jpeg' }), false);
    }, 'image/jpeg', 0.9);
  };

  const startRecording = async () => {
    if (saving) return;
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      playCameraShutter();
      recorderRef.current.stop();
      return;
    }
    primeCameraShutter();
    const session = sessionRef.current;
    const audioPromise = canUseLiveCamera()
      ? navigator.mediaDevices.getUserMedia({ audio: true, video: false }).catch(() => null)
      : Promise.resolve(null);
    const stopAudio = () => {
      void audioPromise.then((audio) => audio?.getTracks().forEach((track) => track.stop()));
    };
    if (!live || !streamRef.current) {
      const started = await startLive(facingRef.current, { fresh: true });
      if (!started || session !== sessionRef.current) {
        stopAudio();
        return;
      }
    }
    const videoStream = streamRef.current;
    if (!videoStream || typeof MediaRecorder === 'undefined') {
      videoInputRef.current?.click();
      stopAudio();
      return;
    }
    const chosen = recorderChoice();
    let mixed: MediaStream = videoStream;
    const audio = await audioPromise;
    if (session !== sessionRef.current) {
      audio?.getTracks().forEach((track) => track.stop());
      return;
    }
    if (audio) {
      audioRef.current = audio;
      mixed = new MediaStream([...videoStream.getVideoTracks(), ...audio.getAudioTracks()]);
    } else {
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
    const startedAt = Date.now();
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
      const durationMs = Math.max(1, Date.now() - startedAt);
      void webmWithDuration(blob, durationMs).then((timed) => {
        openDraft(new File([timed], `${prefix}-${Date.now()}.${ext}`, { type }), true, durationMs);
      });
    };
    discardRecording.current = false;
    recorder.start();
    playCameraShutter();
    setElapsed(0);
    setRecording(true);
    window.setTimeout(() => {
      if (recorder.state !== 'recording') return;
      playCameraShutter();
      recorder.stop();
    }, 120_000);
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

  return createPortal(
    <div className="fixed inset-0 z-[120] flex flex-col overflow-hidden bg-black text-white">
      <div className="relative flex items-center justify-between gap-3 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
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
          className="relative z-10 flex h-12 w-12 items-center justify-center rounded-lg bg-white/15"
          aria-label={t('back')}
        >
          <X className="h-5 w-5" />
        </button>
        {isFix ? (
          <div className="pointer-events-none absolute inset-x-14 flex flex-col items-center justify-center">
            <div className="flex items-center gap-2">
              <span className="block h-6 w-[1.8rem] shrink-0 sm:h-7 sm:w-8">
                <RepairCameraMark line="white" />
              </span>
              <p className="truncate text-base font-bold leading-none tracking-tight sm:text-2xl">{title}</p>
            </div>
            {subtitle ? <p className="mt-0.5 max-w-full truncate text-xs text-white/80">{subtitle}</p> : null}
          </div>
        ) : (
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate font-bold">{title}</p>
            {subtitle ? <p className="truncate text-xs text-white/70">{subtitle}</p> : null}
          </div>
        )}
        {live ? (
          <button
            type="button"
            onClick={() => void startLive(facingRef.current === 'environment' ? 'user' : 'environment')}
            disabled={recording}
            className="relative z-10 flex h-12 w-12 items-center justify-center rounded-lg bg-white/15 disabled:opacity-40"
            aria-label={t('flipCamera')}
          >
            <SwitchCamera className="h-5 w-5" />
          </button>
        ) : (
          <span className="h-12 w-12" />
        )}
      </div>

      <div className="relative mx-2 my-2 min-h-0 flex-1 overflow-hidden rounded-2xl border-4 border-white bg-black md:mx-auto md:w-[80%] md:rounded-[2rem]">
        <video
          ref={videoRef}
          className={!live || draft ? 'hidden' : 'absolute inset-0 h-full w-full object-cover'}
          playsInline
          muted
          autoPlay
        />
        {draft ? (
          draft.video ? (
            <RecordedPreview url={draft.url} durationMs={draft.durationMs} />
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
        <div className="shrink-0 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
          {shots.length > 0 ? (
            <div className="mb-2 flex items-center justify-center gap-3 text-[11px] font-bold uppercase tracking-wide">
              <button
                type="button"
                onClick={() => setCaptureMode('video')}
                disabled={saving || recording}
                className={`uppercase disabled:opacity-40 ${captureMode === 'video' ? 'text-red-500' : 'text-white/45'}`}
              >
                {t('video')}
              </button>
              <button
                type="button"
                onClick={() => setCaptureMode('photo')}
                disabled={saving || recording}
                className={`uppercase disabled:opacity-40 ${captureMode === 'photo' ? 'text-white' : 'text-white/45'}`}
              >
                {t('photoMode')}
              </button>
            </div>
          ) : null}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="relative justify-self-start" style={{ width: 48, height: 48 }}>
          <button
            type="button"
            onClick={() => {
              if (isFix) {
                libraryInputRef.current?.click();
                return;
              }
              setAddOpen(true);
            }}
            disabled={saving || recording || (maxShots != null && shots.length >= maxShots)}
            className="relative flex h-full w-full items-center justify-center overflow-visible rounded-lg disabled:opacity-50"
            aria-label={t('photosFromLibrary')}
          >
            {shots.length === 0 ? (
              <span className="flex h-full w-full items-center justify-center rounded-lg bg-white/15">
                <ImagePlus className="h-5 w-5" />
              </span>
            ) : (
              shots.slice(-5).map((shot, index, stack) => {
                const fromNewest = stack.length - 1 - index;
                const step = Math.ceil(fromNewest / 2);
                const side = fromNewest === 0 ? 0 : (fromNewest % 2 === 1 ? -1 : 1);
                return (
                  <span
                    key={shot.id}
                    className="absolute bottom-0 overflow-hidden rounded-md border-2 border-white bg-black shadow-md"
                    style={{
                      width: 40,
                      height: 40,
                      left: 4,
                      transform: `translateX(${side * step * 8}px) rotate(${side * step * 8}deg)`,
                      transformOrigin: 'center bottom',
                      zIndex: stack.length - fromNewest,
                    }}
                  >
                    {shot.video ? (
                      <video src={shot.url} muted playsInline className="h-full w-full object-cover" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={shot.url} alt="" className="h-full w-full object-cover" />
                    )}
                  </span>
                );
              })
            )}
          </button>
          </div>
          <button
            type="button"
            onClick={() => {
              if (captureMode === 'video') {
                void startRecording();
                return;
              }
              if (live) snapLive();
              else void startLive(facingRef.current, { fresh: true });
            }}
            disabled={saving || (maxShots != null && shots.length >= maxShots && !recording)}
            aria-label={captureMode === 'video' ? (recording ? t('stopVideo') : t('video')) : t('shutter')}
            className="flex shrink-0 items-center justify-center rounded-full border-4 border-white disabled:opacity-50"
            style={{ width: 76, height: 76 }}
          >
            <span
              className={`block rounded-full transition-transform duration-150 ${captureMode === 'video' ? 'bg-red-600' : 'bg-white'}`}
              style={{
                width: 60,
                height: 60,
                transform: captureMode === 'video' && recording ? 'scale(0.72)' : 'scale(1)',
              }}
            />
          </button>
          <div className="flex shrink-0 flex-col items-end gap-2 justify-self-end">
            {shots.length > 0 ? null : (
            <button
              type="button"
              onClick={() => setCaptureMode((mode) => (mode === 'video' ? 'photo' : 'video'))}
              disabled={saving || recording || (maxShots != null && shots.length >= maxShots)}
              className="flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/15 disabled:opacity-50"
              style={{ width: 48, height: 48 }}
              aria-label={captureMode === 'video' ? t('shutter') : t('video')}
            >
              {captureMode === 'video' ? <Camera className="h-5 w-5" /> : <Video className="h-5 w-5" />}
            </button>
            )}
            {shots.length === 0 ? null : (
              <button
                type="button"
                onClick={() => void finish()}
                disabled={saving || recording || shots.length === 0}
                className="flex h-12 items-center justify-center rounded-lg bg-white/15 px-3 text-sm font-bold uppercase text-white disabled:opacity-40"
              >
                {saving ? t('saving') : t('done')}
              </button>
            )}
          </div>
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
        <div className="absolute inset-0 z-30 flex flex-col justify-end bg-black/40">
          <button type="button" className="min-h-0 flex-1" aria-label={t('closePhoto')} onClick={() => setAddOpen(false)} />
          <div className="rounded-t-3xl bg-white px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-2 text-black">
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
        accept="image/*,video/*"
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
