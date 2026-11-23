import type { HubFeedKind } from '@/lib/types/supabase';
import type { ProCardData } from '@/components/proscard/ProCard';

export type FeedScope = 'local' | 'all';

export const FEED_FILTERS = ['all', 'projects', 'estimates', 'repairs', 'reviews', 'members'] as const;
export type FeedFilter = (typeof FEED_FILTERS)[number];

export const FEED_FILTER_KINDS: Record<Exclude<FeedFilter, 'all'>, HubFeedKind[]> = {
  projects: ['project_scheduled', 'project_photos'],
  estimates: ['estimate_requested', 'estimate_sent', 'estimate_approved'],
  repairs: ['fix_requested'],
  reviews: ['feedback_left'],
  members: ['member_joined', 'pro_joined'],
};

export const FEED_PAGE_SIZE = 20;

/** One feed row as the page sees it. Customer names are already "First L.", city only, no amounts. */
export type FeedItem = {
  id: string;
  kind: HubFeedKind;
  occurredAt: string;
  actorName: string | null;
  actorAvatar: string | null;
  targetName: string | null;
  city: string | null;
  serviceLabel: string | null;
  eventDate: string | null;
  photoDayNo: number | null;
  photoSingleDay: boolean;
  excerpt: string | null;
  visibility: 'public' | 'pending' | 'hidden';
  photos: string[];
  business: { slug: string; name: string } | null;
  /** New pro posts show the same ProCard as the HousePros directory. */
  card: ProCardData | null;
  /** The viewer is in this item (pro, business owner, or customer) and may remove it. */
  canRemove: boolean;
};

export type FeedPage = {
  items: FeedItem[];
  nextCursor: string | null;
  isAdmin: boolean;
};
