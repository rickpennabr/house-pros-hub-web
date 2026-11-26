'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react';

export interface LightboxImage {
  url: string;
  name?: string;
}

/**
 * The Hub's photo viewer: full screen over the page (never a new tab), like WhatsApp.
 * Close with ×, Esc or a tap on the dark background; arrows (and ← →) move between photos.
 */
export function ImageLightbox({
  images,
  index,
  onClose,
}: {
  images: LightboxImage[];
  index: number;
  onClose: () => void;
}) {
  const [at, setAt] = useState(index);
  const count = images.length;
  const current = images[Math.min(Math.max(at, 0), count - 1)];
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    stripRef.current?.querySelector<HTMLElement>(`[data-thumb="${at}"]`)?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [at]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') setAt((value) => (value + 1) % count);
      if (event.key === 'ArrowLeft') setAt((value) => (value - 1 + count) % count);
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [count, onClose]);

  if (!current || typeof document === 'undefined') return null;

  const iconButton = 'flex h-10 w-10 items-center justify-center rounded-lg text-white hover:bg-white/15';

  return createPortal(
    <div className="fixed inset-0 z-[200] flex flex-col bg-black/95" role="dialog" aria-modal="true" aria-label="Photo">
      <div className="flex items-center justify-between gap-2 p-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <p className="min-w-0 truncate px-2 text-sm text-white/80">
          {current.name || 'Photo'}
          {count > 1 ? <span className="ml-2 text-white/50">{at + 1} / {count}</span> : null}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <a href={current.url} download={current.name || true} className={iconButton} aria-label="Download">
            <Download className="h-5 w-5" />
          </a>
          <button type="button" onClick={onClose} className={iconButton} aria-label="Close">
            <X className="h-6 w-6" />
          </button>
        </div>
      </div>
      <div
        className="relative flex min-h-0 flex-1 items-center justify-center p-2"
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- chat and user photos come from storage URLs */}
        <img src={current.url} alt={current.name || 'Photo'} className="max-h-full max-w-full object-contain" />
        {count > 1 ? (
          <>
            <button
              type="button"
              onClick={() => setAt((value) => (value - 1 + count) % count)}
              className="absolute left-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg bg-black/50 text-white hover:bg-black/70"
              aria-label="Previous photo"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={() => setAt((value) => (value + 1) % count)}
              className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg bg-black/50 text-white hover:bg-black/70"
              aria-label="Next photo"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        ) : null}
      </div>
      {count > 1 ? (
        <div
          ref={stripRef}
          className="flex shrink-0 gap-2 overflow-x-auto border-t border-white/10 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
        >
          {images.map((image, index) => (
            <button
              key={`${image.url}-${index}`}
              type="button"
              data-thumb={index}
              onClick={() => setAt(index)}
              aria-label={`Photo ${index + 1}`}
              aria-current={index === at}
              className={`h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 md:h-16 md:w-16 ${index === at ? 'border-white' : 'border-transparent opacity-60 hover:opacity-100'}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- storage thumbnails */}
              <img src={image.url} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>,
    document.body
  );
}
