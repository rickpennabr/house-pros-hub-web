import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { deny, requirePortalUser } from '@/lib/places/session';

const BUCKET = 'customer-documents';

/**
 * GET /api/places/documents/[id]
 * Open a contract, project PDF, or agreement the contractor published.
 * The contractor who uploaded it can open it too.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requirePortalUser();
    if (error || !user) return deny(error);
    const { id } = await params;

    const admin = createServiceRoleClient();
    const { data: doc } = await admin
      .from('pro_crm_customer_documents')
      .select('id, owner_id, customer_id, file_path, file_name, visible_to_customer')
      .eq('id', id)
      .maybeSingle();
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    let allowed = doc.owner_id === user.id;
    if (!allowed && doc.visible_to_customer) {
      const { data: customer } = await admin
        .from('pro_crm_customers')
        .select('portal_user_id')
        .eq('id', doc.customer_id)
        .maybeSingle();
      allowed = customer?.portal_user_id === user.id;
    }
    if (!allowed) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    const { data: signed, error: signError } = await admin.storage.from(BUCKET).createSignedUrl(doc.file_path, 60);
    if (signError || !signed?.signedUrl) {
      return NextResponse.json({ error: 'Could not open the file' }, { status: 500 });
    }
    return NextResponse.redirect(signed.signedUrl);
  } catch (err) {
    console.error('GET /api/places/documents/[id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
