import { ADMIN_EMAIL } from '@/lib/constants/admin';
import { createServiceRoleClient } from '@/lib/supabase/server';

export const FEEDBACK_BUCKET = 'business-feedback';
export const MAX_FEEDBACK_IMAGES = 5;
export const MAX_FEEDBACK_CHARS = 2000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface FeedbackBusiness {
  id: string;
  owner_id: string;
  business_name: string;
  slug: string | null;
  business_logo: string | null;
}

export async function loadFeedbackBusiness(slugOrId: string): Promise<FeedbackBusiness | null> {
  const admin = createServiceRoleClient();
  const query = admin
    .from('businesses')
    .select('id, owner_id, business_name, slug, business_logo')
    .eq('is_active', true);
  const { data, error } = await (UUID_RE.test(slugOrId)
    ? query.eq('id', slugOrId)
    : query.eq('slug', slugOrId)
  ).maybeSingle();
  if (error || !data) return null;
  return data;
}

export function isOwnFeedbackImageUrl(url: string): boolean {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
  if (!base) return false;
  return url.startsWith(`${base}/storage/v1/object/public/${FEEDBACK_BUCKET}/`);
}

export function feedbackStorageMissing(message: string | undefined): boolean {
  if (!message) return false;
  return /business_feedback|bucket not found|schema cache/i.test(message);
}

export function isPlatformAdminEmail(email: string | null | undefined): boolean {
  const value = email?.trim().toLowerCase();
  const admin = ADMIN_EMAIL.trim().toLowerCase();
  return Boolean(value && admin && value === admin && admin !== '__client_side_placeholder__');
}

export async function userIsPlatformAdmin(
  userId: string | null | undefined,
  email: string | null | undefined
): Promise<boolean> {
  if (!userId) return false;
  if (isPlatformAdminEmail(email)) return true;
  const admin = createServiceRoleClient();
  const { data } = await admin.from('admin_users').select('user_id').eq('user_id', userId).maybeSingle();
  return Boolean(data);
}

/** The customer who wrote it, or a platform admin. The pro cannot delete a customer's review. */
export function canDeleteBusinessFeedback(input: {
  userId: string | null | undefined;
  isAdmin: boolean;
  authorUserId: string | null | undefined;
  ownerId: string;
}): boolean {
  if (!input.userId) return false;
  if (input.isAdmin) return true;
  if (input.userId === input.ownerId) return false;
  return Boolean(input.authorUserId && input.userId === input.authorUserId);
}

export function acceptedFeedbackImages(
  value: unknown,
  businessId: string
): { ok: true; urls: string[] } | { ok: false; error: string } {
  const urls = Array.isArray(value)
    ? value.filter((url): url is string => typeof url === 'string' && isOwnFeedbackImageUrl(url))
    : [];
  if (urls.length > MAX_FEEDBACK_IMAGES) {
    return { ok: false, error: 'You can add up to 5 photos.' };
  }
  const prefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')}/storage/v1/object/public/${FEEDBACK_BUCKET}/${businessId}/`;
  if (urls.some((url) => !url.startsWith(prefix))) {
    return { ok: false, error: 'Those photos do not belong to this business.' };
  }
  return { ok: true, urls };
}
