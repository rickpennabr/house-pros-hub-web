import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { ADMIN_EMAIL } from '@/lib/constants/admin';
import { validateFileMagicBytes, validateFileSize, getExtensionFromMimeType } from '@/lib/utils/fileValidation';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null };
  }
  if (user.email?.toLowerCase().trim() !== ADMIN_EMAIL.toLowerCase().trim()) {
    return { error: NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 }), user: null };
  }
  return { error: null, user };
}

/**
 * POST /api/admin/upload-profile-picture
 * Upload profile picture for a customer (admin only). Used when adding/editing customers.
 * Body: FormData with "file" (image) and "userId" (customer user id).
 */
export async function POST(request: NextRequest) {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const userId = (formData.get('userId') as string)?.trim();

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    if (!validateFileSize(file.size, 'profile')) {
      return NextResponse.json(
        { error: 'File size must be less than 5MB' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileValidation = await validateFileMagicBytes(buffer);
    if (!fileValidation.isValid || !fileValidation.mimeType) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, and WebP images are allowed.' },
        { status: 400 }
      );
    }

    const service = createServiceRoleClient();
    const fileExt = getExtensionFromMimeType(fileValidation.mimeType);
    const filePath = `${userId}/${Date.now()}${fileExt}`;

    const { data, error } = await service.storage
      .from('profile-pictures')
      .upload(filePath, buffer, {
        cacheControl: '3600',
        upsert: false,
        contentType: fileValidation.mimeType,
      });

    if (error) {
      console.error('Admin upload profile picture error', error);
      return NextResponse.json(
        { error: 'Failed to upload image' },
        { status: 500 }
      );
    }

    const { data: { publicUrl } } = service.storage
      .from('profile-pictures')
      .getPublicUrl(data.path);

    return NextResponse.json({ url: publicUrl, path: data.path }, { status: 200 });
  } catch (error) {
    console.error('POST /api/admin/upload-profile-picture', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
