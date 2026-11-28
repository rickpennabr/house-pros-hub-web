'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';

/**
 * PC "Take photo": a simple webcam box (no camera frame screen).
 * The browser asks for camera permission the first time only and remembers the answer.
 */
export function WebcamCapture({ open, onClose, onPhoto }: { open: boolean; onClose: () => void; onPhoto: (file: File) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // Async start keeps state changes out of the effect body.
    Promise.resolve()
      .then(() => {
        setError(null);
        setReady(false);
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
        return navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          void video.play().catch(() => undefined);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const name = err instanceof DOMException ? err.name : '';
        setError(
          name === 'NotAllowedError'
            ? 'Camera access is blocked. Allow the camera in your browser (the camera icon in the address bar), then try again.'
            : name === 'NotFoundError'
              ? 'No camera was found on this computer. Use Upload a photo instead.'
              : err instanceof Error && err.message === 'unsupported'
                ? 'This browser cannot open the camera. Use Upload a photo instead.'
                : 'Could not open the camera. Use Upload a photo instead.'
        );
      });
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [open]);

  const snap = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onPhoto(new File([blob], `quick-fix-${Date.now()}.jpg`, { type: 'image/jpeg' }));
        onClose();
      },
      'image/jpeg',
      0.9
    );
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Take photo">
      <div className="w-full max-w-2xl rounded-lg border-2 border-black bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Take photo</h2>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-black hover:bg-gray-50" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        {error ? (
          <p className="rounded-lg border-2 border-red-600 bg-red-50 p-3 text-sm text-red-700">{error}</p>
        ) : (
          <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
            <video ref={videoRef} playsInline muted autoPlay onLoadedData={() => setReady(true)} className="h-full w-full object-contain" />
            {!ready ? <p className="absolute inset-0 flex items-center justify-center text-sm text-white/80">Opening the camera…</p> : null}
          </div>
        )}
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border-2 border-black px-4 py-2 font-medium hover:bg-gray-50">
            Cancel
          </button>
          {!error ? (
            <button type="button" onClick={snap} disabled={!ready} className="inline-flex items-center gap-2 rounded-lg bg-black px-4 py-2 font-medium text-white disabled:opacity-50">
              <Camera className="h-4 w-4" /> Take photo
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
