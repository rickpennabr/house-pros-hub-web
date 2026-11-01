import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasRole } from '@/lib/utils/roles';

async function requireContractorAndAttachment(invoiceId: string, attachmentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), supabase: null };
  }
  const isContractor = await hasRole(user.id, 'contractor');
  if (!isContractor) {
    return {
      error: NextResponse.json({ error: 'Forbidden - Contractor access required' }, { status: 403 }),
      supabase: null,
    };
  }
  const { data: attachment, error: fetchError } = await supabase
    .from('pro_crm_invoice_attachments')
    .select('id, invoice_id, owner_id, file_path')
    .eq('id', attachmentId)
    .eq('invoice_id', invoiceId)
    .eq('owner_id', user.id)
    .single();

  if (fetchError || !attachment) {
    return {
      error: NextResponse.json({ error: 'Attachment not found' }, { status: 404 }),
      supabase: null,
    };
  }
  return { error: null, supabase, attachment };
}

/**
 * DELETE /api/crm/invoices/[id]/attachments/[attachmentId]
 * Remove an invoice attachment (storage object + DB row).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  try {
    const { id: invoiceId, attachmentId } = await params;
    if (!invoiceId || !attachmentId) {
      return NextResponse.json({ error: 'Invoice ID and attachment ID required' }, { status: 400 });
    }

    const { error: authError, supabase, attachment } = await requireContractorAndAttachment(invoiceId, attachmentId);
    if (authError || !supabase || !attachment) return authError;

    await supabase.storage.from('invoice-attachments').remove([attachment.file_path]);

    const { error: deleteError } = await supabase
      .from('pro_crm_invoice_attachments')
      .delete()
      .eq('id', attachmentId)
      .eq('owner_id', (attachment as { owner_id: string }).owner_id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message || 'Failed to delete attachment' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/crm/invoices/[id]/attachments/[attachmentId]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
