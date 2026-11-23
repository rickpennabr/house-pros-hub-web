import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { ADMIN_EMAIL } from '@/lib/constants/admin';
import { adminSessionVerified } from '@/lib/auth/admin-mfa';
import { PRO_DRIVE_BUCKET, PRO_DRIVE_SIGNED_URL_SECONDS } from '@/lib/drive/constants';
import type { Database } from '@/lib/types/supabase';
import { getPublicBusiness } from '@/lib/data/businessDirectory';
import type { ProCardData } from '@/components/proscard/ProCard';
import {
  FEED_FILTER_KINDS,
  FEED_PAGE_SIZE,
  type FeedFilter,
  type FeedItem,
  type FeedPage,
  type FeedScope,
} from '@/lib/feed/types';

type FeedRow = Database['public']['Tables']['hub_feed_events']['Row'];

const DEFAULT_CITY = 'Las Vegas';
/** Cities that count as one "Local" area. */
const LAS_VEGAS_METRO = ['las vegas', 'north las vegas', 'henderson', 'boulder city', 'sunrise manor', 'spring valley', 'paradise', 'enterprise', 'summerlin', 'whitney', 'winchester'];

export type FeedViewer = {
  userId: string | null;
  isAdmin: boolean;
  city: string | null;
};

/** Who is looking: signed-in user, whether they are the (two-step verified) admin, and their city. */
export async function getFeedViewer(): Promise<FeedViewer> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { userId: null, isAdmin: false, city: null };
    const isAdminEmail = !!ADMIN_EMAIL && user.email?.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim();
    const isAdmin = isAdminEmail && (await adminSessionVerified(supabase));
    const { data: address } = await supabase
      .from('addresses')
      .select('city')
      .eq('user_id', user.id)
      .eq('address_type', 'personal')
      .limit(1)
      .maybeSingle();
    return { userId: user.id, isAdmin, city: address?.city?.trim() || null };
  } catch {
    return { userId: null, isAdmin: false, city: null };
  }
}

function localCities(city: string | null): string[] {
  const own = (city || DEFAULT_CITY).trim().toLowerCase();
  return LAS_VEGAS_METRO.includes(own) ? LAS_VEGAS_METRO : [own];
}

function parseCursor(cursor: string | null | undefined): { at: string; id: string } | null {
  if (!cursor) return null;
  const [at, id] = cursor.split('|');
  if (!at || !id || Number.isNaN(Date.parse(at)) || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  return { at, id };
}

export async function loadFeedPage(options: {
  viewer: FeedViewer;
  scope: FeedScope;
  filter: FeedFilter;
  cursor?: string | null;
}): Promise<FeedPage> {
  const { viewer, scope, filter } = options;
  const db = createServiceRoleClient();

  let query = db
    .from('hub_feed_events')
    .select('*')
    .order('occurred_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(FEED_PAGE_SIZE + 1);

  // Admins also see photo days waiting for approval. Hidden rows never show here.
  query = viewer.isAdmin ? query.in('visibility', ['public', 'pending']) : query.eq('visibility', 'public');
  if (filter !== 'all') query = query.in('kind', FEED_FILTER_KINDS[filter]);
  if (scope === 'local') {
    const cities = localCities(viewer.city);
    query = query.or(cities.map((c) => `city.ilike."${c.replace(/[,()*%"]/g, '')}"`).join(','));
  }
  const cursor = parseCursor(options.cursor);
  if (cursor) {
    query = query.or(`occurred_at.lt."${cursor.at}",and(occurred_at.eq."${cursor.at}",id.lt.${cursor.id})`);
  }

  const { data, error } = await query;
  if (error) {
    // Migration 161 not applied yet: show an empty feed instead of an error.
    if (error.code === '42P01' || error.code === 'PGRST205') return { items: [], nextCursor: null, isAdmin: viewer.isAdmin };
    throw new Error(error.message);
  }
  const rows = (data ?? []) as FeedRow[];
  const pageRows = rows.slice(0, FEED_PAGE_SIZE);
  const last = pageRows[pageRows.length - 1];
  const nextCursor = rows.length > FEED_PAGE_SIZE && last ? `${last.occurred_at}|${last.id}` : null;

  // Business slugs for "Book this pro" / "View pro".
  const businessIds = [...new Set(pageRows.map((r) => r.business_id).filter((v): v is string => !!v))];
  const businesses = new Map<string, { slug: string; name: string; ownerId: string }>();
  if (businessIds.length > 0) {
    const { data: rowsB } = await db
      .from('businesses')
      .select('id, slug, business_name, owner_id, is_active')
      .in('id', businessIds);
    for (const b of rowsB ?? []) {
      if (b.slug && b.is_active !== false) businesses.set(b.id, { slug: b.slug, name: b.business_name, ownerId: b.owner_id });
    }
  }

  // Job photos live in the private pro-drive bucket: sign them for this page view.
  const fileIds = [...new Set(pageRows.flatMap((r) => r.photo_drive_file_ids ?? []))];
  const signedByFile = new Map<string, string>();
  if (fileIds.length > 0) {
    const { data: files } = await db.from('pro_drive_files').select('id, storage_path').in('id', fileIds);
    const paths = (files ?? []).map((f) => f.storage_path);
    if (paths.length > 0) {
      const { data: signed } = await db.storage.from(PRO_DRIVE_BUCKET).createSignedUrls(paths, PRO_DRIVE_SIGNED_URL_SECONDS);
      const urlByPath = new Map((signed ?? []).filter((s) => s.signedUrl && s.path).map((s) => [s.path as string, s.signedUrl]));
      for (const f of files ?? []) {
        const url = urlByPath.get(f.storage_path);
        if (url) signedByFile.set(f.id, url);
      }
    }
  }

  // New pro posts render the real directory ProCard, like BrazaFeed reuses its listing cards.
  const cardBusinessIds = [
    ...new Set(pageRows.filter((r) => r.kind === 'pro_joined' && r.business_id).map((r) => r.business_id as string)),
  ];
  const cards = new Map<string, ProCardData>();
  await Promise.all(
    cardBusinessIds.map(async (id) => {
      try {
        const card = await getPublicBusiness(id);
        if (card) cards.set(id, card);
      } catch {
        // A missing card falls back to the compact activity card.
      }
    })
  );

  const items: FeedItem[] = pageRows.map((r) => {
    const business = r.business_id ? businesses.get(r.business_id) ?? null : null;
    const uid = viewer.userId;
    const canRemove = !!uid && (uid === r.actor_user_id || uid === r.target_user_id || uid === business?.ownerId);
    return {
      id: r.id,
      kind: r.kind,
      occurredAt: r.occurred_at,
      actorName: r.actor_name,
      actorAvatar: r.actor_avatar,
      targetName: r.target_name,
      city: r.city,
      serviceLabel: r.service_label,
      eventDate: r.event_date,
      photoDayNo: r.photo_day_no,
      photoSingleDay: r.photo_single_day,
      excerpt: r.excerpt,
      visibility: r.visibility,
      photos: (r.photo_drive_file_ids ?? []).map((id) => signedByFile.get(id)).filter((u): u is string => !!u).slice(0, 8),
      business: business ? { slug: business.slug, name: business.name } : null,
      card: r.kind === 'pro_joined' && r.business_id ? cards.get(r.business_id) ?? null : null,
      canRemove,
    };
  });

  return { items, nextCursor, isAdmin: viewer.isAdmin };
}

/**
 * Change an item's visibility. Admins may set any value; a person in the item may only hide it.
 * Returns an HTTP status.
 */
export async function setFeedVisibility(
  viewer: FeedViewer,
  id: string,
  visibility: 'public' | 'pending' | 'hidden'
): Promise<number> {
  if (!viewer.userId) return 401;
  const db = createServiceRoleClient();
  const { data: row } = await db
    .from('hub_feed_events')
    .select('id, actor_user_id, target_user_id, business_id')
    .eq('id', id)
    .maybeSingle();
  if (!row) return 404;

  if (!viewer.isAdmin) {
    if (visibility !== 'hidden') return 403;
    let allowed = viewer.userId === row.actor_user_id || viewer.userId === row.target_user_id;
    if (!allowed && row.business_id) {
      const { data: b } = await db.from('businesses').select('owner_id').eq('id', row.business_id).maybeSingle();
      allowed = b?.owner_id === viewer.userId;
    }
    if (!allowed) return 403;
  }

  const { error } = await db.from('hub_feed_events').update({ visibility }).eq('id', id);
  return error ? 500 : 200;
}
