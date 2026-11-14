import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { placePhotoUrl } from '@/lib/places/portal';
import { deny, requirePortalUser } from '@/lib/places/session';
import { getExtensionFromMimeType, validateFileMagicBytes } from '@/lib/utils/fileValidation';

const BUCKET = 'place-photos';
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * POST /api/places/[id]/photo
 * Store a photo of this place. The customer owns the place.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, user, supabase } = await requirePortalUser();
    if (error || !user) return deny(error);
    const { id } = await params;

    const { data: place } = await supabase
      .from('customer_places')
      .select('id, photo_path')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!place) return NextResponse.json({ error: 'Place not found' }, { status: 404 });

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Image must be 5MB or smaller.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const validation = await validateFileMagicBytes(buffer);
    if (!validation.isValid || !validation.mimeType) {
      return NextResponse.json({ error: 'Use a JPEG, PNG, or WebP image.' }, { status: 400 });
    }

    const path = `${user.id}/${id}${getExtensionFromMimeType(validation.mimeType)}`;
    const service = createServiceRoleClient();
    const uploaded = await service.storage.from(BUCKET).upload(path, buffer, {
      contentType: validation.mimeType,
      cacheControl: '3600',
      upsert: true,
    });
    if (uploaded.error) {
      console.error('POST /api/places/[id]/photo', uploaded.error);
      const missingBucket = /bucket not found/i.test(uploaded.error.message);
      return NextResponse.json(
        {
          error: missingBucket
            ? 'Photo storage is not ready. Apply supabase/migrations/117_place_photo.sql.'
            : 'Could not save the photo.',
        },
        { status: missingBucket ? 503 : 500 }
      );
    }

    if (place.photo_path && place.photo_path !== path) {
      await service.storage.from(BUCKET).remove([place.photo_path]);
    }

    const { data: saved, error: updateError } = await supabase
      .from('customer_places')
      .update({ photo_path: path })
      .eq('id', id)
      .eq('user_id', user.id)
      .select('updated_at')
      .single();
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    return NextResponse.json({ photoUrl: placePhotoUrl(path, saved?.updated_at) });
  } catch (err) {
    console.error('POST /api/places/[id]/photo', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
