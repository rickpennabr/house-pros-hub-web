export type BillboardKind = 'image' | 'video' | 'promotion';

export const BILLBOARD_MAX_SLIDES = 12;
export const BILLBOARD_VIDEO_CAP_SECONDS = 45;
export const BILLBOARD_BUCKET = 'pro-billboard';

export interface BillboardSlide {
  id: string;
  businessId: string;
  kind: BillboardKind;
  mediaUrl: string | null;
  headline: string | null;
  body: string | null;
  badge: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  durationSeconds: number;
  /** Calendar date YYYY-MM-DD, or null when the slide has no start. */
  startsOn: string | null;
  endsOn: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BillboardSlideInput {
  kind: BillboardKind;
  mediaUrl?: string | null;
  headline?: string | null;
  body?: string | null;
  badge?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  isActive?: boolean;
  durationSeconds?: number;
  startsOn?: string | null;
  endsOn?: string | null;
}
