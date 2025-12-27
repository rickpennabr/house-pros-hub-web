export const LINK_TYPES = [
  'phone',
  'email',
  'discord',
  'facebook',
  'linkedin',
  'x',
  'instagram',
  'website',
  'calendar',
  'location',
  'whatsapp',
  'youtube',
  'tiktok',
  'telegram',
  'yelp',
  'nextdoor',
  'angi',
] as const;

export type LinkType = (typeof LINK_TYPES)[number];

export function isLinkType(value: unknown): value is LinkType {
  return typeof value === 'string' && (LINK_TYPES as readonly string[]).includes(value);
}


