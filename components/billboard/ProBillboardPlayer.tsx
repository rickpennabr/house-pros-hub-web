'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Pause, Play } from 'lucide-react';
import type { ReactNode } from 'react';
import { BILLBOARD_VIDEO_CAP_SECONDS, type BillboardSlide } from '@/lib/billboard/types';

const FRAME = 'relative h-[200px] w-full overflow-hidden bg-black md:h-[300px] lg:h-[350px]';

interface ProBillboardPlayerProps {
  slides: BillboardSlide[];
  businessName: string;
}

function SlideFace({ slide, businessName }: { slide: BillboardSlide; businessName: string }) {
  const caption = slide.headline?.trim() || '';
  const showCaption = slide.kind !== 'promotion' && caption;
  return (
    <div className="absolute inset-0">
      {slide.mediaUrl && slide.kind !== 'video' ? (
        <Image
          src={slide.mediaUrl}
          alt={caption || businessName}
          fill
          unoptimized
          className="object-cover"
          sizes="(max-width: 1200px) 100vw, 1200px"
        />
      ) : null}
      {slide.kind === 'promotion' ? (
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/20" />
      ) : null}
      {showCaption ? (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-10 md:p-4">
          <p className="max-w-xl text-base font-bold text-white md:text-2xl">{caption}</p>
        </div>
      ) : null}
      {slide.kind === 'promotion' ? (
        <div className="absolute inset-0 flex flex-col justify-end p-3 pb-10 md:p-5 md:pb-12">
          {slide.badge ? (
            <span className="mb-2 w-fit rounded-md bg-yellow-400 px-2 py-1 text-xs font-bold uppercase tracking-wide text-black">
              {slide.badge}
            </span>
          ) : null}
          <h2 className="max-w-xl text-xl font-bold leading-tight text-white md:text-4xl">{slide.headline}</h2>
          {slide.body ? <p className="mt-1 max-w-xl text-sm text-white/90 md:text-base">{slide.body}</p> : null}
          {slide.ctaLabel && slide.ctaUrl ? (
            <a
              href={slide.ctaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 w-fit cursor-pointer rounded-lg bg-white px-3 py-2 text-sm font-bold text-black"
            >
              {slide.ctaLabel}
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Rotates a business's billboard slides in the hero slot: photos hold, videos play muted, promotions read like an outdoor board.
 */
export function ProBillboardPlayer({ slides, businessName }: ProBillboardPlayerProps) {
  const t = useTranslations('proBillboard');
  const [index, setIndex] = useState(0);
  const [tick, setTick] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides.length;
  const safeIndex = count === 0 ? 0 : index % count;
  const slide = slides[safeIndex];
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const node = videoRef.current;
    if (!node || slide?.kind !== 'video') return;
    node.muted = true;
    if (paused) {
      node.pause();
      return;
    }
    void node.play().catch(() => setPaused(true));
  }, [paused, slide, tick]);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setPaused(true);
  }, []);

  useEffect(() => {
    if (!slide || paused || slide.kind === 'video') return;
    const timer = window.setTimeout(() => {
      setIndex((current) => (current + 1) % count);
      setTick((current) => current + 1);
    }, slide.durationSeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [slide, paused, count, tick]);

  useEffect(() => {
    if (!slide || slide.kind !== 'video' || paused) return;
    const timer = window.setTimeout(() => {
      setIndex((current) => (current + 1) % count);
      setTick((current) => current + 1);
    }, BILLBOARD_VIDEO_CAP_SECONDS * 1000);
    return () => window.clearTimeout(timer);
  }, [slide, paused, count, tick]);

  if (!slide) return null;

  const barSeconds = slide.kind === 'video' ? BILLBOARD_VIDEO_CAP_SECONDS : slide.durationSeconds;

  const advance = () => {
    setIndex((current) => (current + 1) % count);
    setTick((current) => current + 1);
  };

  return (
    <div className={FRAME} role="region" aria-label={t('playerLabel', { name: businessName })}>
      <style>{'@keyframes hph-billboard-bar { from { width: 0% } to { width: 100% } }'}</style>
      <div key={`${slide.id}-${tick}`} className="absolute inset-0">
        <SlideFace slide={slide} businessName={businessName} />
        {slide.kind === 'video' && slide.mediaUrl ? (
          <video
            key={`${slide.mediaUrl}-${tick}`}
            ref={videoRef}
            className="absolute inset-0 z-10 h-full w-full object-cover"
            src={slide.mediaUrl}
            muted
            playsInline
            onEnded={advance}
          />
        ) : null}
      </div>
      <div className="absolute left-2 top-2 z-20 rounded-md bg-black/70 px-2 py-1 text-xs font-medium text-white">
        {t('slideOf', { current: safeIndex + 1, total: count })}
      </div>
      <button
        type="button"
        onClick={() => setPaused((current) => !current)}
        className="absolute bottom-3 left-2 z-20 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-black/70 text-white"
        aria-label={paused ? t('play') : t('pause')}
      >
        {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
      </button>
      {count > 1 ? (
        <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-1">
          {slides.map((item, itemIndex) => (
            <button
              key={item.id}
              type="button"
              aria-label={t('goToSlide', { number: itemIndex + 1 })}
              onClick={() => {
                setIndex(itemIndex);
                setTick((current) => current + 1);
              }}
              className={`h-1.5 cursor-pointer rounded-sm ${itemIndex === safeIndex ? 'w-6 bg-white' : 'w-3 bg-white/50'}`}
            />
          ))}
        </div>
      ) : null}
      <div className="absolute inset-x-0 bottom-0 z-20 h-1 bg-white/30">
        <div
          key={`bar-${slide.id}-${tick}`}
          className="h-full bg-white"
          style={{
            width: paused ? '0%' : undefined,
            animation: paused ? undefined : `hph-billboard-bar ${barSeconds}s linear forwards`,
          }}
        />
      </div>
    </div>
  );
}

interface ProBillboardStageProps {
  businessId: string;
  businessName: string;
  isOwner: boolean;
  manageHref: string;
  children: ReactNode;
}

/** Plays the live board in the hero. With nothing scheduled, the still photo stays. */
export function ProBillboardStage({ businessId, businessName, isOwner, manageHref, children }: ProBillboardStageProps) {
  const t = useTranslations('proBillboard');
  const [slides, setSlides] = useState<BillboardSlide[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/businesses/${businessId}/billboard`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { slides?: BillboardSlide[] } | null) => {
        if (!cancelled) setSlides(data?.slides ?? []);
      })
      .catch(() => {
        if (!cancelled) setSlides([]);
      });
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  if (!slides || slides.length === 0) return <>{children}</>;

  return (
    <div className="relative">
      <ProBillboardPlayer slides={slides} businessName={businessName} />
      {isOwner ? (
        <Link
          href={manageHref}
          className="absolute right-2 top-2 z-30 flex h-8 cursor-pointer items-center rounded-lg border-2 border-black bg-white px-3 text-sm font-medium text-black shadow hover:bg-gray-50"
        >
          {t('ownerEdit')}
        </Link>
      ) : null}
    </div>
  );
}
