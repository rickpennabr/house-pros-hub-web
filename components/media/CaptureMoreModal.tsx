'use client';

import { Camera, Check, Video } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Modal from '@/components/ui/Modal';

export interface CaptureShot {
  key: string;
  url: string;
  video: boolean;
}

/**
 * Phones: after the phone's own camera returns a photo or video, ask "Take another" or "I'm done".
 * Take another runs inside this tap, so the phone camera opens again right away.
 */
export function CaptureMoreModal({
  open,
  canTakeMore = true,
  onAnother,
  onDone,
  zIndex,
  shots = [],
}: {
  open: boolean;
  /** False when the limit is reached (only "I'm done" shows). */
  canTakeMore?: boolean;
  onAnother: () => void;
  onDone: () => void;
  /** Above a full-screen layer (the job album sits at 300). */
  zIndex?: number;
  /** What was taken so far, newest last (photo or video previews). */
  shots?: CaptureShot[];
}) {
  const t = useTranslations('common.captureMore');
  return (
    <Modal isOpen={open} onClose={onDone} title={t('title')} maxWidth="sm" overlayStyle={zIndex ? { zIndex } : undefined}>
      {shots.length > 0 ? (
        <div className="mb-3">
          <p className="mb-2 text-sm font-semibold">{t('taken', { count: shots.length })}</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {shots.map((shot) => (
              <span key={shot.key} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 border-black bg-black">
                {shot.video ? (
                  <>
                    <video src={shot.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                    <Video className="absolute bottom-0.5 right-0.5 h-4 w-4 text-white drop-shadow" aria-hidden />
                  </>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={shot.url} alt="" className="h-full w-full object-cover" />
                )}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      <p className="mb-4 text-sm text-gray-600">{canTakeMore ? t('body') : t('full')}</p>
      <div className="flex flex-col gap-2">
        {canTakeMore ? (
          <button
            type="button"
            onClick={onAnother}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-black text-base font-bold text-white hover:bg-gray-800"
          >
            <Camera className="h-5 w-5 text-red-500" />
            {t('another')}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onDone}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-lg border-2 border-black bg-white text-base font-bold text-black hover:bg-gray-50"
        >
          <Check className="h-5 w-5" />
          {t('done')}
        </button>
      </div>
    </Modal>
  );
}
