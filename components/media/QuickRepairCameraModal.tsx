'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Camera } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { requestCurrentLocation, reverseGeocode } from '@/lib/media/capture-location';
import {
  QUICK_REPAIR_CAMERA_OPEN_EVENT,
  QUICK_REPAIR_PHOTO_EVENT,
  type QuickRepairPhotoRequest,
} from '@/lib/media/quick-repair-camera';
import {
  loadQuickRepairDraft,
  saveQuickRepairDraft,
  type QuickRepairDraft,
} from '@/lib/media/quick-repair-draft';
import type { Locale } from '@/i18n';

const MAX_PHOTOS = 5;

function blankDraft(): QuickRepairDraft {
  return {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    trade: '',
    description: '',
    streetAddress: '',
    city: '',
    state: '',
    zipCode: '',
    latitude: null,
    longitude: null,
    accuracyM: null,
    photos: [],
  };
}

async function persistCapturedPhoto(file: File): Promise<'full' | 'saved'> {
  const existing = await loadQuickRepairDraft();
  const draft = existing ?? blankDraft();
  if (draft.photos.length >= MAX_PHOTOS) return 'full';
  const shot = await requestCurrentLocation();
  const found = shot ? await reverseGeocode(shot.latitude, shot.longitude) : null;
  await saveQuickRepairDraft({
    ...draft,
    streetAddress: draft.streetAddress || found?.streetAddress || '',
    city: draft.city || found?.city || '',
    state: draft.state || found?.state || '',
    zipCode: draft.zipCode || found?.zipCode || '',
    latitude: draft.latitude ?? shot?.latitude ?? null,
    longitude: draft.longitude ?? shot?.longitude ?? null,
    accuracyM: draft.accuracyM ?? shot?.accuracyM ?? null,
    photos: [
      ...draft.photos,
      { name: file.name, type: file.type || 'image/jpeg', blob: file, driveId: null },
    ],
  });
  return 'saved';
}

/**
 * Opens when a camera icon is clicked. The browser's own permission dialog
 * is the allow/deny step. This modal is only the viewfinder and the shutter.
 */
export function QuickRepairCameraHost() {
  const t = useTranslations('procam');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const generation = useRef(0);
  const [open, setOpen] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const close = () => {
    generation.current += 1;
    stopTracks();
    setCameraOn(false);
    setBusy(false);
    setError(null);
    setOpen(false);
  };

  const start = async () => {
    const token = generation.current + 1;
    generation.current = token;
    stopTracks();
    setError(null);
    setCameraOn(false);
    setBusy(false);
    setOpen(true);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(t('cameraUnavailable'));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      if (token !== generation.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      setCameraOn(true);
    } catch {
      if (token !== generation.current) return;
      setError(t('cameraDenied'));
    }
  };

  const startRef = useRef(start);

  useEffect(() => {
    startRef.current = start;
  });

  useEffect(() => {
    const onOpen = () => {
      void startRef.current();
    };
    window.addEventListener(QUICK_REPAIR_CAMERA_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(QUICK_REPAIR_CAMERA_OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!open || !cameraOn || !video || !stream) return;
    video.srcObject = stream;
    void video.play().catch(() => undefined);
  }, [open, cameraOn]);

  useEffect(() => {
    return () => {
      generation.current += 1;
      stopTracks();
    };
  }, []);

  const snap = async () => {
    const video = videoRef.current;
    if (!video || busy) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!blob) return;
    const file = new File([blob], `procam-${Date.now()}.jpg`, { type: 'image/jpeg' });
    stopTracks();
    setCameraOn(false);
    setBusy(true);
    const detail: QuickRepairPhotoRequest = { file };
    const delivered = new CustomEvent<QuickRepairPhotoRequest>(QUICK_REPAIR_PHOTO_EVENT, {
      cancelable: true,
      detail,
    });
    window.dispatchEvent(delivered);
    if (detail.rejectReason === 'full') {
      setBusy(false);
      setError(t('maxPhotos'));
      return;
    }
    if (delivered.defaultPrevented) {
      close();
      return;
    }
    try {
      const result = await persistCapturedPhoto(file);
      if (result === 'full') {
        setBusy(false);
        setError(t('maxPhotos'));
        return;
      }
      const onRepair = pathname?.endsWith('/quick-repair') ?? false;
      close();
      if (!onRepair) router.push(`/${locale}/quick-repair`);
    } catch {
      setBusy(false);
      setError(t('draftFailed'));
    }
  };

  const skip = () => {
    const onRepair = pathname?.endsWith('/quick-repair') ?? false;
    close();
    if (!onRepair) router.push(`/${locale}/quick-repair`);
  };

  return (
    <Modal isOpen={open} onClose={close} title={t('title')} showHeader showCloseButton maxWidth="lg" contentClassName="p-4">
      <div className="space-y-4">
        <div className="relative flex w-full aspect-[4/3] items-center justify-center overflow-hidden rounded-lg border-2 border-black bg-black">
          {cameraOn ? (
            <video ref={videoRef} className="h-full w-full object-cover" playsInline muted autoPlay />
          ) : (
            <p className={`px-6 text-center text-sm ${error ? 'text-red-300' : 'text-white'}`}>
              {busy ? t('captureHint') : error ?? t('cameraWaiting')}
            </p>
          )}
        </div>
        {cameraOn && (
          <div className="space-y-2">
            <p className="text-center text-sm">{t('captureHint')}</p>
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => void snap()}
                disabled={busy}
                aria-label={t('snap')}
                className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-full border-4 border-white bg-black text-white shadow-[0_0_0_2px_#000] disabled:opacity-50"
              >
                <Camera className="h-7 w-7" />
              </button>
            </div>
          </div>
        )}
        <Button type="button" variant="ghost" onClick={skip} disabled={busy}>
          {t('skipToUpload')}
        </Button>
      </div>
    </Modal>
  );
}
