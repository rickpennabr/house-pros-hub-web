import type { BillboardSlide } from '@/lib/billboard/types';

/** Calendar date in UTC, matching how slide start/end dates are stored. */
export function utcToday(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function isSlideLive(
  slide: Pick<BillboardSlide, 'isActive' | 'startsOn' | 'endsOn'>,
  today = utcToday(),
): boolean {
  if (!slide.isActive) return false;
  if (slide.startsOn && slide.startsOn > today) return false;
  if (slide.endsOn && slide.endsOn < today) return false;
  return true;
}

export function liveSlides(slides: BillboardSlide[], today = utcToday()): BillboardSlide[] {
  return slides.filter((slide) => isSlideLive(slide, today));
}
