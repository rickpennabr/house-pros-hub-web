import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { sanitizeText } from '@/lib/utils/sanitize';
import {
  MAX_FEEDBACK_CHARS,
  acceptedFeedbackImages,
  feedbackStorageMissing,
  loadFeedbackBusiness,
} from '@/lib/feedback/businessFeedback';

export const dynamic = 'force-dynamic';

/**
 * POST /api/businesses/[id]/feedback/[feedbackId]/reply
 * The business owner posts or replaces their reply, including photos.
 * The pro cannot delete the customer's review from this route.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; feedbackId: string }> }
) {
  const { id, feedbackId } = await params;
  const business = await loadFeedbackBusiness(id);
  if (!business) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Sign in to reply.' }, { status: 401 });
  }
  if (user.id !== business.owner_id) {
    return NextResponse.json({ error: 'Only this pro can reply.' }, { status: 403 });
  }

  const payload = (await request.json().catch(() => null)) as {
    response?: unknown;
    imageUrls?: unknown;
  } | null;
  const response = sanitizeText(typeof payload?.response === 'string' ? payload.response : '');
  if (response.length > MAX_FEEDBACK_CHARS) {
    return NextResponse.json({ error: 'Write a reply of 2000 characters or less.' }, { status: 400 });
  }

  const images = acceptedFeedbackImages(payload?.imageUrls, business.id);
  if (!images.ok) {
    return NextResponse.json({ error: images.error }, { status: 400 });
  }
  if (!response && images.urls.length === 0) {
    return NextResponse.json({ error: 'Write a reply or add a photo.' }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const respondedAt = new Date().toISOString();
  const { data, error } = await admin
    .from('business_feedback')
    .update({
      pro_response: response || null,
      pro_response_image_urls: images.urls,
      pro_responded_at: respondedAt,
    })
    .eq('id', feedbackId)
    .eq('business_id', business.id)
    .select('id')
    .maybeSingle();

  if (error) {
    const missing = feedbackStorageMissing(error.message);
    return NextResponse.json(
      { error: missing ? 'Feedback is not ready yet.' : 'Could not post the reply.' },
      { status: missing ? 503 : 500 }
    );
  }
  if (!data) {
    return NextResponse.json({ error: 'Feedback not found' }, { status: 404 });
  }

  return NextResponse.json({
    proResponse: response || null,
    proResponseImageUrls: images.urls,
    proRespondedAt: respondedAt,
  });
}
