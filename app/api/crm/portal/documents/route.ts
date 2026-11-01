import { NextRequest, NextResponse } from 'next/server';
import { requireContractor } from '@/lib/crm/require-contractor';
import { deny } from '@/lib/places/session';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { DOCUMENT_KINDS, type DocumentKind } from '@/lib/places/portal';
import { cleanText } from '@/lib/places/session';
import { getExtensionFromMimeType, MAX_FILE_SIZES, validateInvoiceAttachmentMagicBytes } from '@/lib/utils/fileValidation';

const BUCKET = 'customer-documents';

/**
 * POST /api/crm/portal/documents
 * Publish a contract, project PDF, or maintenance agreement to the customer's place.
 */
export async function POST(request: NextRequest) {
  try {
    const { error, user, supabase } = await requireContractor();
    if (error || !user || !supabase) return deny(error);

    const rateLimitRes = await checkRateLimit(request, 'upload', user.id);
    if (rateLimitRes) return rateLimitRes;

    const formData = await request.formData();
    const file = formData.get('file');
    const customerId = cleanText(formData.get('customerId'), 40);
    const title = cleanText(formData.get('title'), 160);
    const kindRaw = formData.get('kind');
    const kind: DocumentKind | null = typeof kindRaw === 'string' && DOCUMENT_KINDS.includes(kindRaw as DocumentKind)
      ? (kindRaw as DocumentKind)
      : null;
    const projectId = cleanText(formData.get('projectId'), 40) || null;

    if (!(file instanceof File) || !customerId || !title || !kind) {
      return NextResponse.json({ error: 'Customer, title, type, and a PDF or image are required.' }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZES.invoiceAttachment) {
      return NextResponse.json({ error: 'File size must be 20 MB or less' }, { status: 400 });
    }

    const { data: customer } = await supabase
      .from('pro_crm_customers')
      .select('id')
      .eq('id', customerId)
      .eq('owner_id', user.id)
      .maybeSingle();
    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

    if (projectId) {
      const { data: project } = await supabase
        .from('pro_crm_projects')
        .select('id')
        .eq('id', projectId)
        .eq('owner_id', user.id)
        .eq('customer_id', customerId)
        .maybeSingle();
      if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const validation = await validateInvoiceAttachmentMagicBytes(buffer);
    if (!validation.isValid || !validation.mimeType) {
      return NextResponse.json({ error: 'Invalid file type. Allowed: JPEG, PNG, WebP, PDF.' }, { status: 400 });
    }

    const ext = getExtensionFromMimeType(validation.mimeType);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'file';
    const filePath = `${user.id}/${customerId}/${Date.now()}-${safeName}${ext}`;
    const { data: uploaded, error: uploadError } = await supabase.storage.from(BUCKET).upload(filePath, buffer, {
      cacheControl: '86400',
      upsert: false,
      contentType: validation.mimeType,
    });
    if (uploadError || !uploaded) {
      console.error('Customer document upload error:', uploadError);
      return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
    }

    const { error: insertError } = await supabase.from('pro_crm_customer_documents').insert({
      owner_id: user.id,
      customer_id: customerId,
      project_id: projectId,
      kind,
      title,
      file_name: file.name.slice(0, 180),
      file_path: uploaded.path,
      file_size_bytes: file.size,
      content_type: validation.mimeType,
      visible_to_customer: true,
    });
    if (insertError) {
      await supabase.storage.from(BUCKET).remove([uploaded.path]);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error('POST /api/crm/portal/documents', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
