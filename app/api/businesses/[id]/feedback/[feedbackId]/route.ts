import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import {
  canDeleteBusinessFeedback,
  feedbackStorageMissing,
  loadFeedbackBusiness,
  userIsPlatformAdmin,
} from '@/lib/feedback/businessFeedback';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/businesses/[id]/feedback/[feedbackId]
 * The customer who wrote the review, or a platform admin, can delete it.
 * The pro cannot delete a customer's feedback.
 */
export async function DELETE(
  _request: NextRequest,
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
    return NextResponse.json({ error: 'Sign in to delete feedback.' }, { status: 401 });
  }

  const admin = createServiceRoleClient();
  const { data: row, error: loadError } = await admin
    .from('business_feedback')
    .select('id, author_user_id')
    .eq('id', feedbackId)
    .eq('business_id', business.id)
    .maybeSingle();

  if (loadError) {
    const missing = feedbackStorageMissing(loadError.message);
    return NextResponse.json(
      { error: missing ? 'Feedback is not ready yet.' : 'Could not delete this feedback.' },
      { status: missing ? 503 : 500 }
    );
  }
  if (!row) {
    return NextResponse.json({ error: 'Feedback not found' }, { status: 404 });
  }

  const isAdmin = await userIsPlatformAdmin(user.id, user.email);
  const allowed = canDeleteBusinessFeedback({
    userId: user.id,
    isAdmin,
    authorUserId: row.author_user_id,
    ownerId: business.owner_id,
  });
  if (!allowed) {
    return NextResponse.json({ error: 'Only the person who wrote this, or an admin, can delete it.' }, { status: 403 });
  }

  const { error } = await admin.from('business_feedback').delete().eq('id', feedbackId).eq('business_id', business.id);
  if (error) {
    return NextResponse.json({ error: 'Could not delete this feedback.' }, { status: 500 });
  }

  return NextResponse.json({ deleted: true });
}
