import { NextRequest, NextResponse } from 'next/server';
import { requireContractor } from '@/lib/crm/require-contractor';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { getExtensionFromMimeType, MAX_FILE_SIZES, validateInvoiceAttachmentMagicBytes } from '@/lib/utils/fileValidation';

const BUCKET = 'customer-documents';

/** Attachments on a contact: the pro's own files (not shown on the Customer portal). */
async function ownContact(supabase: NonNullable<Awaited<ReturnType<typeof requireContractor>>['supabase']>, ownerId: string, customerId: string) {
  const { data } = await supabase
    .from('pro_crm_customers')
    .select('id')
    .eq('id', customerId)
    .eq('owner_id', ownerId)
    .maybeSingle();
  return Boolean(data);
}

/** GET /api/crm/customers/[id]/attachments */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, user, supabase } = await requireContractor();
  if (error || !user || !supabase) return error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  if (!(await ownContact(supabase, user.id, id))) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

  const { data, error: listError } = await supabase
    .from('pro_crm_customer_documents')
    .select('id, file_name, file_size_bytes, content_type, created_at')
    .eq('owner_id', user.id)
    .eq('customer_id', id)
    .eq('visible_to_customer', false)
    .is('project_id', null)
    .is('maintenance_plan_id', null)
    .order('created_at', { ascending: true });
  if (listError) return NextResponse.json({ error: listError.message }, { status: 500 });
  return NextResponse.json({
    attachments: (data ?? []).map((row) => ({
      id: row.id,
      fileName: row.file_name,
      fileSizeBytes: row.file_size_bytes,
      contentType: row.content_type,
      url: `/api/places/documents/${row.id}`,
    })),
  });
}

/** POST /api/crm/customers/[id]/attachments (multipart "file") */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error, user, supabase } = await requireContractor();
    if (error || !user || !supabase) return error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const limited = await checkRateLimit(request, 'upload', user.id);
    if (limited) return limited;
    const { id } = await params;
    if (!(await ownContact(supabase, user.id, id))) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

    const file = (await request.formData()).get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    if (file.size > MAX_FILE_SIZES.invoiceAttachment) {
      return NextResponse.json({ error: 'File size must be 20 MB or less' }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const check = await validateInvoiceAttachmentMagicBytes(buffer);
    if (!check.isValid || !check.mimeType) {
      return NextResponse.json({ error: 'Use a PDF, JPEG, PNG or WebP file.' }, { status: 400 });
    }

    const safeName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'file';
    const path = `${user.id}/${id}/attachments/${Date.now()}-${safeName}${getExtensionFromMimeType(check.mimeType)}`;
    const { data: uploaded, error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, { cacheControl: '86400', upsert: false, contentType: check.mimeType });
    if (uploadError || !uploaded) {
      console.error('POST contact attachment upload', uploadError?.message);
      return NextResponse.json({ error: 'Could not upload the file' }, { status: 500 });
    }

    const { data: row, error: insertError } = await supabase
      .from('pro_crm_customer_documents')
      .insert({
        owner_id: user.id,
        customer_id: id,
        kind: 'other',
        title: file.name.slice(0, 160),
        file_name: file.name.slice(0, 180),
        file_path: uploaded.path,
        file_size_bytes: file.size,
        content_type: check.mimeType,
        visible_to_customer: false,
      })
      .select('id, file_name, file_size_bytes, content_type')
      .single();
    if (insertError || !row) {
      await supabase.storage.from(BUCKET).remove([uploaded.path]);
      return NextResponse.json({ error: insertError?.message || 'Could not save the file' }, { status: 500 });
    }
    return NextResponse.json(
      {
        attachment: {
          id: row.id,
          fileName: row.file_name,
          fileSizeBytes: row.file_size_bytes,
          contentType: row.content_type,
          url: `/api/places/documents/${row.id}`,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('POST /api/crm/customers/[id]/attachments', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** DELETE /api/crm/customers/[id]/attachments?attachmentId= */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, user, supabase } = await requireContractor();
  if (error || !user || !supabase) return error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const attachmentId = request.nextUrl.searchParams.get('attachmentId') ?? '';
  const { data: row } = await supabase
    .from('pro_crm_customer_documents')
    .select('id, file_path')
    .eq('id', attachmentId)
    .eq('owner_id', user.id)
    .eq('customer_id', id)
    .eq('visible_to_customer', false)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
  const { error: deleteError } = await supabase.from('pro_crm_customer_documents').delete().eq('id', row.id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
  await supabase.storage.from(BUCKET).remove([row.file_path]);
  return NextResponse.json({ ok: true });
}
