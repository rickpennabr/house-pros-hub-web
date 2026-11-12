'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, HardDrive, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { requestCurrentLocation, type CaptureLocation } from '@/lib/media/capture-location';

/** Phones have no hover and a coarse pointer. They use the system camera, which works on http://LAN as well as https. */
function useNativeCamera(): boolean {
  const [nativeCamera, setNativeCamera] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(hover: none) and (pointer: coarse)');
    const apply = () => setNativeCamera(query.matches);
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);
  return nativeCamera;
}

interface ProCamCaptureSheetProps {
  isOpen: boolean;
  onClose: () => void;
  showDrive?: boolean;
  onPickDrive?: () => void;
  /** Attach the device position. Off skips the location prompt. */
  withLocation?: boolean;
  /** Fires once the browser has granted the camera and the viewfinder is on. */
  onCameraReady?: () => void;
  /** When false, the sheet stays open so another photo can be taken. */
  closeOnCapture?: boolean;
  title?: string;
  intro?: string | null;
  notice?: string | null;
  error?: string | null;
  onCapture: (result: { file: File; location: CaptureLocation | null }) => void | Promise<void>;
}

export function ProCamCaptureSheet({
  isOpen,
  onClose,
  showDrive = false,
  onPickDrive,
  withLocation = true,
  onCameraReady,
  closeOnCapture = true,
  title,
  intro,
  notice,
  error,
  onCapture,
}: ProCamCaptureSheetProps) {
  const t = useTranslations('procam');
  const nativeCamera = useNativeCamera();
  const videoRef = useRef<HTMLVideoElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startingRef = useRef(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (!isOpen) {
      setCameraOn(false);
      setCameraError(null);
    }
  }

  useEffect(() => {
    if (!isOpen) stopTracks();
    return () => stopTracks();
  }, [isOpen]);

  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!cameraOn || !video || !stream) return;
    video.srcObject = stream;
    void video.play().catch(() => undefined);
  }, [cameraOn]);

  const finish = async (file: File) => {
    setBusy(true);
    const location = withLocation ? await requestCurrentLocation() : null;
    try {
      await onCapture({ file, location });
      stopTracks();
      setCameraOn(false);
      if (closeOnCapture) onClose();
    } catch {
      stopTracks();
      setCameraOn(false);
    } finally {
      setBusy(false);
    }
  };

  const startCamera = async () => {
    if (startingRef.current || busy || cameraOn) return;
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(t('cameraUnavailable'));
      return;
    }
    startingRef.current = true;
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
      } catch (error) {
        const name = error instanceof DOMException ? error.name : '';
        if (name !== 'OverconstrainedError' && name !== 'NotFoundError') throw error;
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      streamRef.current = stream;
      setCameraOn(true);
      onCameraReady?.();
    } catch (error) {
      stopTracks();
      setCameraOn(false);
      const name = error instanceof DOMException ? error.name : '';
      setCameraError(
        name === 'NotAllowedError' || name === 'PermissionDeniedError'
          ? t('cameraDenied')
          : t('cameraUnavailable')
      );
    } finally {
      startingRef.current = false;
    }
  };

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
    await finish(new File([blob], `procam-${Date.now()}.jpg`, { type: 'image/jpeg' }));
  };

  const heading = title ?? t('whyTitle');
  const explanation = title ? intro : t('whyBody');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={heading} showHeader showCloseButton maxWidth="lg">
      <div className="space-y-4">
        {explanation ? <p className="text-sm text-gray-700">{explanation}</p> : null}
        {notice ? <p className="text-sm">{notice}</p> : null}
        {(error || cameraError) && <p className="text-sm text-red-600">{error || cameraError}</p>}
        <video
          ref={videoRef}
          className={cameraOn ? 'aspect-[4/3] w-full rounded-lg border-2 border-black bg-black object-cover' : 'hidden'}
          playsInline
          muted
          autoPlay
        />
        <div className="flex flex-wrap gap-2">
          {cameraOn ? (
            <Button type="button" onClick={() => void snap()} disabled={busy}>
              <Camera className="w-4 h-4 inline mr-2" />
              {t('snap')}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => {
                if (nativeCamera) {
                  setCameraError(null);
                  cameraInputRef.current?.click();
                  return;
                }
                void startCamera();
              }}
              disabled={busy}
            >
              <Camera className="w-4 h-4 inline mr-2" />
              {t('camera')}
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={() => inputRef.current?.click()} disabled={busy}>
            <ImagePlus className="w-4 h-4 inline mr-2" />
            {t('photos')}
          </Button>
          {showDrive && onPickDrive && (
            <Button type="button" variant="secondary" onClick={onPickDrive} disabled={busy}>
              <HardDrive className="w-4 h-4 inline mr-2" />
              {t('drive')}
            </Button>
          )}
          {cameraOn && (
            <Button type="button" variant="ghost" onClick={() => { stopTracks(); setCameraOn(false); }}>
              <X className="w-4 h-4 inline mr-2" />
              {t('closeCamera')}
            </Button>
          )}
        </div>
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void finish(file);
          }}
        />
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void finish(file);
          }}
        />
      </div>
    </Modal>
  );
}
