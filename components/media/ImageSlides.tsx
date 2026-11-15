'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

export interface SlideImage {
  src: string;
  alt?: string;
}

interface ImageSlideViewerProps {
  images: SlideImage[];
  open: boolean;
  index: number;
  label: string;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

interface ImageSlidesProps {
  images: SlideImage[];
  /** Name announced with the photos, used when an image has no alt. */
  label: string;
  /** Stage fills its parent. Use this inside a fixed-height column. */
  fill?: boolean;
}

const controlClass =
  'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-white bg-black/70 text-white transition-colors hover:bg-black';

function clampIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  return ((index % count) + count) % count;
}

function useSwipe(onStep: (direction: -1 | 1) => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);

  const onTouchStart = (event: React.TouchEvent) => {
    const touch = event.changedTouches[0];
    if (!touch) return;
    start.current = { x: touch.clientX, y: touch.clientY };
    swiped.current = false;
  };

  const onTouchEnd = (event: React.TouchEvent) => {
    const origin = start.current;
    const touch = event.changedTouches[0];
    start.current = null;
    if (!origin || !touch) return;
    const dx = touch.clientX - origin.x;
    const dy = touch.clientY - origin.y;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return;
    swiped.current = true;
    onStep(dx > 0 ? -1 : 1);
  };

  return { onTouchStart, onTouchEnd, swiped };
}

/**
 * Full-screen photo viewer. Swipe, arrow keys, and the on-screen arrows move
 * between photos. Use this anywhere a set of images should open large.
 */
export function ImageSlideViewer({ images, open, index, label, onIndexChange, onClose }: ImageSlideViewerProps) {
  const t = useTranslations('common');
  const [mounted, setMounted] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const count = images.length;
  const current = clampIndex(index, count);
  const slide = images[current];

  const step = useCallback(
    (direction: -1 | 1) => {
      if (count < 2) return;
      onIndexChange(clampIndex(current + direction, count));
    },
    [count, current, onIndexChange]
  );

  const swipe = useSwipe(step);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft') step(-1);
      if (event.key === 'ArrowRight') step(1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose, step]);

  if (!open || !mounted || !slide || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex flex-col bg-black text-white"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
      role="dialog"
      aria-modal="true"
      aria-label={t('slides.view')}
    >
      <div className="flex h-14 shrink-0 items-center justify-between px-2">
        <p className="min-w-11 px-2 text-sm font-semibold tabular-nums">
          {t('slides.count', { current: current + 1, total: count })}
        </p>
        <button ref={closeRef} type="button" onClick={onClose} className={controlClass} aria-label={t('slides.close')}>
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        {count > 1 ? (
          <button
            type="button"
            onClick={() => step(-1)}
            className={`${controlClass} absolute left-2 top-1/2 z-10 -translate-y-1/2`}
            aria-label={t('slides.previous')}
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        ) : null}
        <div
          className="absolute inset-0 flex items-center justify-center px-14"
          onClick={onClose}
          onTouchStart={swipe.onTouchStart}
          onTouchEnd={swipe.onTouchEnd}
        >
          <div className="relative h-full w-full" onClick={(event) => event.stopPropagation()}>
            <Image
              src={slide.src}
              alt={slide.alt || label}
              fill
              className="object-contain"
              sizes="100vw"
              priority
              unoptimized={slide.src.startsWith('data:')}
            />
          </div>
        </div>
        {count > 1 ? (
          <button
            type="button"
            onClick={() => step(1)}
            className={`${controlClass} absolute right-2 top-1/2 z-10 -translate-y-1/2`}
            aria-label={t('slides.next')}
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        ) : null}
      </div>

      {count > 1 ? (
        <div className="flex shrink-0 gap-2 overflow-x-auto px-3 py-3">
          {images.map((image, imageIndex) => (
            <button
              key={`${image.src}-${imageIndex}`}
              type="button"
              onClick={() => onIndexChange(imageIndex)}
              className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 bg-black ${
                imageIndex === current ? 'border-white' : 'border-transparent opacity-70'
              }`}
              aria-label={t('slides.thumbnail', { index: imageIndex + 1 })}
              aria-current={imageIndex === current}
            >
              <Image
                src={image.src}
                alt=""
                fill
                className="object-cover"
                sizes="56px"
                unoptimized={image.src.startsWith('data:')}
              />
            </button>
          ))}
        </div>
      ) : (
        <div className="h-3 shrink-0" />
      )}
    </div>,
    document.body
  );
}

/**
 * Ecommerce photo stage: the selected image, a thumbnail strip, and the shared
 * full-screen viewer. Reuse this for services, products, and any other gallery.
 */
export function ImageSlides({ images, label, fill = false }: ImageSlidesProps) {
  const t = useTranslations('common');
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const count = images.length;
  const current = clampIndex(index, count);
  const slide = images[current];
  const swipe = useSwipe((direction) => setIndex((value) => clampIndex(value + direction, count)));

  if (!slide) return null;

  return (
    <div className={`flex min-w-0 flex-col gap-2 ${fill ? 'h-full min-h-0' : ''}`}>
      <div className={`relative overflow-hidden rounded-lg border-2 border-black bg-neutral-100 ${fill ? 'min-h-0 flex-1' : 'aspect-square w-full'}`}>
        <button
          type="button"
          className="absolute inset-0 cursor-zoom-in"
          aria-label={t('slides.view')}
          onClick={() => {
            if (swipe.swiped.current) {
              swipe.swiped.current = false;
              return;
            }
            setOpen(true);
          }}
          onTouchStart={swipe.onTouchStart}
          onTouchEnd={swipe.onTouchEnd}
        >
          <Image
            src={slide.src}
            alt={slide.alt || label}
            fill
            className="object-contain"
            sizes="(max-width: 768px) 100vw, 480px"
            priority={current === 0}
            unoptimized={slide.src.startsWith('data:')}
          />
        </button>
        {count > 1 ? (
          <>
            <button
              type="button"
              onClick={() => setIndex(clampIndex(current - 1, count))}
              className="absolute left-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border-2 border-black bg-white text-black"
              aria-label={t('slides.previous')}
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={() => setIndex(clampIndex(current + 1, count))}
              className="absolute right-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border-2 border-black bg-white text-black"
              aria-label={t('slides.next')}
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        ) : null}
      </div>

      {count > 1 ? (
        <div className="flex gap-2 overflow-x-auto">
          {images.map((image, imageIndex) => (
            <button
              key={`${image.src}-${imageIndex}`}
              type="button"
              onClick={() => setIndex(imageIndex)}
              className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 bg-white ${
                imageIndex === current ? 'border-black' : 'border-neutral-300'
              }`}
              aria-label={t('slides.thumbnail', { index: imageIndex + 1 })}
              aria-current={imageIndex === current}
            >
              <Image
                src={image.src}
                alt=""
                fill
                className="object-cover"
                sizes="56px"
                unoptimized={image.src.startsWith('data:')}
              />
            </button>
          ))}
        </div>
      ) : null}

      <ImageSlideViewer
        images={images}
        open={open}
        index={current}
        label={label}
        onIndexChange={setIndex}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}
