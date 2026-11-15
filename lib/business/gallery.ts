import { MAX_BUSINESS_GALLERY_IMAGES } from '@/lib/constants/businessGallery';

export interface GalleryImage {
  url: string;
  tags: string[];
}

const MAX_TAGS = 8;
const MAX_TAG_LENGTH = 32;

function cleanTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'string') continue;
    const tag = entry.trim().replace(/\s+/g, ' ').slice(0, MAX_TAG_LENGTH);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
    if (tags.length >= MAX_TAGS) break;
  }
  return tags;
}

/** Read gallery JSON. Older rows stored plain photo URLs. */
export function parseGallery(raw: unknown): GalleryImage[] {
  if (!Array.isArray(raw)) return [];
  const items: GalleryImage[] = [];
  for (const entry of raw) {
    if (typeof entry === 'string') {
      const url = entry.trim();
      if (url) items.push({ url, tags: [] });
      continue;
    }
    if (!entry || typeof entry !== 'object' || typeof (entry as { url?: unknown }).url !== 'string') continue;
    const url = (entry as { url: string }).url.trim();
    if (!url) continue;
    items.push({ url, tags: cleanTags((entry as { tags?: unknown }).tags) });
  }
  return items.slice(0, MAX_BUSINESS_GALLERY_IMAGES);
}

/**
 * Save a gallery. A plain URL keeps the tags already stored for that photo.
 * An object replaces the tags, including when the list is empty.
 */
export function writeGallery(previous: unknown, incoming: unknown): GalleryImage[] {
  if (!Array.isArray(incoming)) return [];
  const previousTags = new Map(parseGallery(previous).map((item) => [item.url, item.tags]));
  const next: GalleryImage[] = [];
  for (const entry of incoming) {
    if (typeof entry === 'string') {
      const url = entry.trim();
      if (!url) continue;
      next.push({ url, tags: previousTags.get(url) ?? [] });
      continue;
    }
    if (!entry || typeof entry !== 'object' || typeof (entry as { url?: unknown }).url !== 'string') continue;
    const url = (entry as { url: string }).url.trim();
    if (!url) continue;
    next.push({ url, tags: cleanTags((entry as { tags?: unknown }).tags) });
  }
  return next.slice(0, MAX_BUSINESS_GALLERY_IMAGES);
}
