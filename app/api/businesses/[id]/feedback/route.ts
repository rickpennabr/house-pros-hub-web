import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { sanitizeText } from '@/lib/utils/sanitize';
import {
  FEEDBACK_BUCKET,
  MAX_FEEDBACK_CHARS,
  MAX_FEEDBACK_IMAGES,
  canDeleteBusinessFeedback,
  feedbackStorageMissing,
  isOwnFeedbackImageUrl,
  loadFeedbackBusiness,
  userIsPlatformAdmin,
} from '@/lib/feedback/businessFeedback';

export const dynamic = 'force-dynamic';

interface FeedbackRow {
  id: string;
  author_user_id: string | null;
  author_name: string;
  body: string;
  image_urls: string[] | null;
  pro_response: string | null;
  pro_response_image_urls: string[] | null;
  pro_responded_at: string | null;
  created_at: string;
}

const FEEDBACK_COLUMNS =
  'id, author_user_id, author_name, body, image_urls, pro_response, pro_response_image_urls, pro_responded_at, created_at';

function toPublicFeedback(
  row: FeedbackRow,
  viewer: { userId: string | null; isAdmin: boolean; ownerId: string }
) {
  return {
    id: row.id,
    authorName: row.author_name,
    body: row.body,
    imageUrls: row.image_urls || [],
    proResponse: row.pro_response,
    proResponseImageUrls: row.pro_response_image_urls || [],
    proRespondedAt: row.pro_responded_at,
    createdAt: row.created_at,
    canDelete: canDeleteBusinessFeedback({
      userId: viewer.userId,
      isAdmin: viewer.isAdmin,
      authorUserId: row.author_user_id,
      ownerId: viewer.ownerId,
    }),
  };
}

/**
 * GET /api/businesses/[id]/feedback
 * Public list of feedback for a business. The owner flag is true for the signed-in pro.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const business = await loadFeedbackBusiness(id);
  if (!business) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createServiceRoleClient();
  if (request.nextUrl.searchParams.get('summary') === '1') {
    const { count, error } = await admin
      .from('business_feedback')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', business.id);
    if (error) {
      const missing = feedbackStorageMissing(error.message);
      return NextResponse.json(
        { error: missing ? 'Feedback is not ready yet.' : 'Could not load feedback.' },
        { status: missing ? 503 : 500 }
      );
    }
    return NextResponse.json({ count: count ?? 0 });
  }

  const { data, error, count } = await admin
    .from('business_feedback')
    .select(FEEDBACK_COLUMNS, { count: 'exact' })
    .eq('business_id', business.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    const missing = feedbackStorageMissing(error.message);
    return NextResponse.json(
      { error: missing ? 'Feedback is not ready yet.' : 'Could not load feedback.' },
      { status: missing ? 503 : 500 }
    );
  }

  const isAdmin = await userIsPlatformAdmin(user?.id, user?.email);
  const viewer = { userId: user?.id ?? null, isAdmin, ownerId: business.owner_id };
  const feedback = ((data || []) as FeedbackRow[]).map((row) => toPublicFeedback(row, viewer));

  return NextResponse.json({
    business: {
      id: business.id,
      name: business.business_name,
      slug: business.slug,
      logo: business.business_logo,
    },
    isOwner: !!user?.id && user.id === business.owner_id,
    count: count ?? feedback.length,
    feedback,
  });
}

/**
 * POST /api/businesses/[id]/feedback
 * Signed-in customer posts feedback and up to five photos already stored in the feedback bucket.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const business = await loadFeedbackBusiness(id);
  if (!business) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in to leave feedback.' }, { status: 401 });
  }
  if (user.id === business.owner_id) {
    return NextResponse.json({ error: 'Reply to feedback from your business page.' }, { status: 403 });
  }

  const payload = (await request.json().catch(() => null)) as { body?: unknown; imageUrls?: unknown } | null;
  const body = sanitizeText(typeof payload?.body === 'string' ? payload.body : '');
  if (!body || body.length > MAX_FEEDBACK_CHARS) {
    return NextResponse.json({ error: 'Write feedback of 2000 characters or less.' }, { status: 400 });
  }

  const imageUrls = Array.isArray(payload?.imageUrls)
    ? payload.imageUrls.filter((url): url is string => typeof url === 'string' && isOwnFeedbackImageUrl(url))
    : [];
  if (imageUrls.length > MAX_FEEDBACK_IMAGES) {
    return NextResponse.json({ error: 'You can add up to 5 photos.' }, { status: 400 });
  }

  const prefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')}/storage/v1/object/public/${FEEDBACK_BUCKET}/${business.id}/`;
  if (imageUrls.some((url) => !url.startsWith(prefix))) {
    return NextResponse.json({ error: 'Those photos do not belong to this business.' }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('first_name, last_name')
    .eq('id', user.id)
    .maybeSingle();
  const authorName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim() ||
    user.email?.split('@')[0] ||
    'Customer';

  const { data, error } = await admin
    .from('business_feedback')
    .insert({
      business_id: business.id,
      author_user_id: user.id,
      author_name: authorName.slice(0, 120),
      body,
      image_urls: imageUrls,
    })
    .select(FEEDBACK_COLUMNS)
    .single();

  if (error || !data) {
    const missing = feedbackStorageMissing(error?.message);
    return NextResponse.json(
      { error: missing ? 'Feedback is not ready yet.' : 'Could not post feedback.' },
      { status: missing ? 503 : 500 }
    );
  }

  const row = data as FeedbackRow;
  return NextResponse.json({
    feedback: toPublicFeedback(row, { userId: user.id, isAdmin: false, ownerId: business.owner_id }),
  });
}
