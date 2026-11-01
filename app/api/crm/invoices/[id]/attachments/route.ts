import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasRole } from '@/lib/utils/roles';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import {
  validateInvoiceAttachmentMagicBytes,
  getExtensionFromMimeType,
  MAX_FILE_SIZES,
} from '@/lib/utils/fileValidation';

const BUCKET = 'invoice-attachments';

async function requireContractorAndInvoice(invoiceId: string) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null, supabase: null };
  }
  const isContractor = await hasRole(user.id, 'contractor');
  if (!isContractor) {
    return {
      error: NextResponse.json({ error: 'Forbidden - Contractor access required' }, { status: 403 }),
      user: null,
      supabase: null,
    };
  }
  const { data: invoice } = await supabase
    .from('pro_crm_invoices')
    .select('id, owner_id')
    .eq('id', invoiceId)
    .eq('owner_id', user.id)
    .single();
  if (!invoice) {
    return {
      error: NextResponse.json({ error: 'Invoice not found' }, { status: 404 }),
      user: null,
      supabase: null,
    };
  }
  return { error: null, user, supabase };
}

/**
 * POST /api/crm/invoices/[id]/attachments
 * Upload one file for an invoice. Max 20MB; PDF, JPEG, PNG, WebP.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: invoiceId } = await params;
    if (!invoiceId) return NextResponse.json({ error: 'Invoice ID required' }, { status: 400 });

    const { error: authError, user, supabase } = await requireContractorAndInvoice(invoiceId);
    if (authError || !user || !supabase) return authError;

    const rateLimitRes = await checkRateLimit(request, 'upload', user.id);
    if (rateLimitRes) return rateLimitRes;

    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZES.invoiceAttachment) {
      return NextResponse.json(
        { error: 'File size must be 20 MB or less' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const validation = await validateInvoiceAttachmentMagicBytes(buffer);
    if (!validation.isValid || !validation.mimeType) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: JPEG, PNG, WebP, PDF.' },
        { status: 400 }
      );
    }

    const ext = getExtensionFromMimeType(validation.mimeType);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'file';
    const filePath = `${user.id}/${invoiceId}/${Date.now()}-${safeName}${ext}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, buffer, {
        cacheControl: '86400',
        upsert: false,
        contentType: validation.mimeType,
      });

    if (uploadError) {
      console.error('Invoice attachment upload error:', uploadError);
      return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
    }

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(uploadData.path);

    const { data: row, error: insertError } = await supabase
      .from('pro_crm_invoice_attachments')
      .insert({
        invoice_id: invoiceId,
        owner_id: user.id,
        file_name: file.name,
        file_path: uploadData.path,
        file_size_bytes: file.size,
        content_type: validation.mimeType,
      })
      .select('id, file_name, file_path, file_size_bytes, content_type, created_at')
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message || 'Failed to save attachment' }, { status: 500 });
    }

    return NextResponse.json({
      id: row.id,
      fileName: row.file_name,
      url: publicUrl,
      fileSizeBytes: row.file_size_bytes,
      contentType: row.content_type,
      createdAt: row.created_at,
    }, { status: 201 });
  } catch (err) {
    console.error('POST /api/crm/invoices/[id]/attachments', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
