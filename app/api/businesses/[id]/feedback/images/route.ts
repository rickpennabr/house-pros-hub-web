import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { getExtensionFromMimeType, validateFileMagicBytes } from '@/lib/utils/fileValidation';
import { FEEDBACK_BUCKET, loadFeedbackBusiness } from '@/lib/feedback/businessFeedback';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * POST /api/businesses/[id]/feedback/images
 * Upload one feedback photo. Customers attach it to a review. The pro attaches it to a reply.
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
    return NextResponse.json({ error: 'Sign in to add photos.' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Each photo must be 5MB or smaller.' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const validation = await validateFileMagicBytes(buffer);
  if (!validation.isValid || !validation.mimeType) {
    return NextResponse.json({ error: 'Use a JPEG, PNG, or WebP image.' }, { status: 400 });
  }

  const extension = getExtensionFromMimeType(validation.mimeType);
  const path = `${business.id}/${crypto.randomUUID()}${extension}`;
  const admin = createServiceRoleClient();
  const uploaded = await admin.storage.from(FEEDBACK_BUCKET).upload(path, buffer, {
    contentType: validation.mimeType,
    cacheControl: '3600',
  });

  if (uploaded.error) {
    const missing = /bucket not found/i.test(uploaded.error.message);
    return NextResponse.json(
      { error: missing ? 'Feedback photo storage is not ready yet.' : 'Could not upload the photo.' },
      { status: missing ? 503 : 500 }
    );
  }

  const { data } = admin.storage.from(FEEDBACK_BUCKET).getPublicUrl(path);
  return NextResponse.json({ imageUrl: data.publicUrl });
}
