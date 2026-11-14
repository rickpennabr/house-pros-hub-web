'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface FeedbackPhotosProps {
  urls: string[];
  thumbClassName?: string;
  /** Lets a parent modal stay open while the slides are on screen. */
  onOpenChange?: (open: boolean) => void;
}

/** Thumbnails that open a full-screen, swipeable slideshow. */
export default function FeedbackPhotos({ urls, thumbClassName = 'h-16 w-16', onOpenChange }: FeedbackPhotosProps) {
  const t = useTranslations('businessFeedback');
  const [index, setIndex] = useState<number | null>(null);
  const touchStartX = useRef<number | null>(null);
  const open = index !== null && urls[index] !== undefined;
  const current = open ? index : 0;

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setIndex(null);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        setIndex((value) => (value === null ? value : Math.min(urls.length - 1, value + 1)));
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setIndex((value) => (value === null ? value : Math.max(0, value - 1)));
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open, urls.length]);

  if (urls.length === 0) return null;

  const go = (delta: number) => {
    setIndex((value) => {
      const base = value ?? 0;
      return Math.min(urls.length - 1, Math.max(0, base + delta));
    });
  };

  const viewer =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed inset-0 z-[400] flex flex-col bg-black text-white"
            role="dialog"
            aria-modal="true"
            aria-label={t('photos')}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
              <p className="text-sm font-medium">
                {t('photoPosition', { current: current + 1, total: urls.length })}
              </p>
              <button
                type="button"
                onClick={() => setIndex(null)}
                className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-white"
                aria-label={t('closePhotos')}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div
              className="relative flex min-h-0 flex-1 items-center justify-center"
              onTouchStart={(event) => {
                touchStartX.current = event.changedTouches[0]?.clientX ?? null;
              }}
              onTouchEnd={(event) => {
                const start = touchStartX.current;
                const end = event.changedTouches[0]?.clientX;
                touchStartX.current = null;
                if (start == null || end == null) return;
                const delta = end - start;
                if (delta > 48) go(-1);
                else if (delta < -48) go(1);
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={urls[current]}
                alt={t('photoPosition', { current: current + 1, total: urls.length })}
                className="max-h-full max-w-full object-contain"
              />
              {urls.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => go(-1)}
                    disabled={current === 0}
                    className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white text-black disabled:opacity-30"
                    aria-label={t('previousPhoto')}
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                  <button
                    type="button"
                    onClick={() => go(1)}
                    disabled={current === urls.length - 1}
                    className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white text-black disabled:opacity-30"
                    aria-label={t('nextPhoto')}
                  >
                    <ChevronRight className="h-6 w-6" />
                  </button>
                </>
              )}
            </div>

            {urls.length > 1 && (
              <div className="flex items-center justify-center gap-2 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
                {urls.map((url, dotIndex) => (
                  <button
                    key={`${url}-${dotIndex}`}
                    type="button"
                    onClick={() => setIndex(dotIndex)}
                    className={`h-2.5 w-2.5 rounded-full ${dotIndex === current ? 'bg-white' : 'bg-white/40'}`}
                    aria-label={t('photoPosition', { current: dotIndex + 1, total: urls.length })}
                  />
                ))}
              </div>
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div className="mt-3 flex flex-wrap gap-2">
        {urls.map((url, photoIndex) => (
          <button
            key={`${url}-${photoIndex}`}
            type="button"
            onClick={() => setIndex(photoIndex)}
            className={`overflow-hidden rounded-lg border-2 border-black ${thumbClassName}`}
            aria-label={t('openPhoto', { current: photoIndex + 1, total: urls.length })}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
      {viewer}
    </>
  );
}
