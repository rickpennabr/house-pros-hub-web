import type { BillboardSlide, BillboardSlideInput } from '@/lib/billboard/types';
import { BILLBOARD_BUCKET } from '@/lib/billboard/types';

/** Path inside the pro-billboard bucket, or null when the URL is not this business's file. */
export function billboardStoragePath(url: string | null | undefined, businessId: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const marker = `/${BILLBOARD_BUCKET}/${businessId}/`;
    const index = parsed.pathname.indexOf(marker);
    if (index === -1) return null;
    const path = decodeURIComponent(parsed.pathname.slice(index + `/${BILLBOARD_BUCKET}/`.length));
    if (!path.startsWith(`${businessId}/`) || path.includes('..') || path.includes('\\')) return null;
    return path;
  } catch {
    return null;
  }
}

export function isOwnBillboardMedia(url: string | null | undefined, businessId: string): boolean {
  return billboardStoragePath(url, businessId) !== null;
}
