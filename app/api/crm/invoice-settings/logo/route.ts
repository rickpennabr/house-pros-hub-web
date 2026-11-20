import { NextRequest, NextResponse } from 'next/server';
import { requireContractor } from '@/lib/crm/require-contractor';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { getExtensionFromMimeType, validateFileMagicBytes, validateFileSize } from '@/lib/utils/fileValidation';

/**
 * POST /api/crm/invoice-settings/logo (multipart "file")
 * Upload a logo for invoices only; the business profile logo is not changed.
 */
export async function POST(request: NextRequest) {
  try {
    const limited = await checkRateLimit(request, 'upload');
    if (limited) return limited;
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError;

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    if (!validateFileSize(file.size, 'logo')) {
      return NextResponse.json({ error: 'Logo must be 5MB or less' }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const check = await validateFileMagicBytes(buffer);
    if (!check.isValid || !check.mimeType) {
      return NextResponse.json({ error: 'Use a JPEG, PNG or WebP image.' }, { status: 400 });
    }

    // Stored under the pro's id: the bucket's policies are per business, so upload as the service.
    const admin = createServiceRoleClient();
    const path = `invoice-logos/${user.id}/logo-${Date.now()}${getExtensionFromMimeType(check.mimeType)}`;
    const { data: uploaded, error: uploadError } = await admin.storage
      .from('business-logos')
      .upload(path, buffer, { cacheControl: '3600', upsert: false, contentType: check.mimeType });
    if (uploadError) {
      console.error('POST /api/crm/invoice-settings/logo upload', uploadError.message);
      return NextResponse.json({ error: 'Could not upload the logo' }, { status: 500 });
    }
    const {
      data: { publicUrl },
    } = admin.storage.from('business-logos').getPublicUrl(uploaded.path);

    const supabase = await createClient();
    const { error } = await supabase
      .from('pro_invoice_settings')
      .upsert({ owner_id: user.id, logo_url: publicUrl }, { onConflict: 'owner_id', ignoreDuplicates: false });
    if (error) {
      const missing = /logo_url/.test(error.message);
      return NextResponse.json(
        { error: missing ? 'Apply migration 147 to save an invoice logo.' : error.message },
        { status: 500 }
      );
    }
    return NextResponse.json({ logoUrl: publicUrl });
  } catch (err) {
    console.error('POST /api/crm/invoice-settings/logo', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
