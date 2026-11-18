import { NextRequest, NextResponse } from 'next/server';
import { requireContractor } from '@/lib/crm/require-contractor';
import { createClient } from '@/lib/supabase/server';
import { ensureBillable } from '@/lib/crm/hub-customer';

/**
 * POST /api/crm/customers/[id]/billable
 * The pro is sending this contact an estimate or invoice from the chat, so give it the
 * Customer role when it has no role that can be invoiced. Contractor only; must own the contact.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError!;

    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Customer ID required' }, { status: 400 });

    const supabase = await createClient();
    const { data: row } = await supabase
      .from('pro_crm_customers')
      .select('id')
      .eq('id', id)
      .eq('owner_id', user.id)
      .maybeSingle();
    if (!row) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

    const result = await ensureBillable(supabase, row.id);
    if (result) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/crm/customers/[id]/billable', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
