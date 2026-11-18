import { NextRequest, NextResponse } from 'next/server';
import { requireContractor } from '@/lib/crm/require-contractor';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { listContactProperties } from '@/lib/places/contact-places';

/**
 * GET /api/crm/customers/[id]/places
 * The contact's properties: the My Places houses the customer shared with this pro or approved
 * for them. The default comes first. Estimates and invoices pick one of these.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const properties = await listContactProperties(createServiceRoleClient(), row.id);
    return NextResponse.json({ properties });
  } catch (err) {
    console.error('GET /api/crm/customers/[id]/places', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
