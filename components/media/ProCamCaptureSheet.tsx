'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, HardDrive, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { requestCurrentLocation, type CaptureLocation } from '@/lib/media/capture-location';

interface ProCamCaptureSheetProps {
  isOpen: boolean;
  onClose: () => void;
  showDrive?: boolean;
  onPickDrive?: () => void;
  /** Open the viewfinder as soon as the sheet opens. The browser asks if access was not granted. */
  autoStart?: boolean;
  /** Attach the device position. Off skips the location prompt. */
  withLocation?: boolean;
  /** Fires once the browser has granted the camera and the viewfinder is on. */
  onCameraReady?: () => void;
  onCapture: (result: { file: File; location: CaptureLocation | null }) => void;
}

export function ProCamCaptureSheet({ isOpen, onClose, showDrive = false, onPickDrive, autoStart = false, withLocation = true, onCameraReady, onCapture }: ProCamCaptureSheetProps) {
  const t = useTranslations('procam');
  const videoRef = useRef<HTMLVideoElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
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
    if (!isOpen) setCameraOn(false);
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
    setBusy(false);
    stopTracks();
    setCameraOn(false);
    onCapture({ file, location });
    onClose();
  };

  const startCamera = async () => {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(t('cameraUnavailable'));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
      onCameraReady?.();
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch {
      setCameraError(t('cameraDenied'));
    }
  };

  useEffect(() => {
    if (!isOpen || !autoStart) return;
    void startCamera();
    // Only the open transition should ask. startCamera is recreated each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, autoStart]);

  const snap = async () => {
    const video = videoRef.current;
    if (!video) return;
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('whyTitle')} showHeader showCloseButton maxWidth="lg">
      <div className="space-y-4">
        <p className="text-sm text-gray-700">{t('whyBody')}</p>
        {cameraError && <p className="text-sm text-red-600">{cameraError}</p>}
        {cameraOn && (
          <video ref={videoRef} className="w-full rounded-lg border-2 border-black bg-black" playsInline muted />
        )}
        <div className="flex flex-wrap gap-2">
          {cameraOn ? (
            <Button type="button" onClick={snap} disabled={busy}>
              <Camera className="w-4 h-4 inline mr-2" />
              {t('snap')}
            </Button>
          ) : (
            <Button type="button" onClick={startCamera} disabled={busy}>
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
