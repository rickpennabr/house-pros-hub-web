import { NextRequest, NextResponse } from 'next/server';
import { requireContractor } from '@/lib/crm/require-contractor';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { addProProperty, listContactProperties } from '@/lib/places/contact-places';
import { readProPropertyInput } from '@/lib/places/pro-property-input';

const MAX_PRO_PROPERTIES = 50;

async function ownedContactId(id: string, ownerId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data: row } = await supabase
    .from('pro_crm_customers')
    .select('id')
    .eq('id', id)
    .eq('owner_id', ownerId)
    .maybeSingle();
  return row?.id ?? null;
}

/**
 * GET /api/crm/customers/[id]/places
 * The contact's properties: the My Places houses the customer shared with this pro or approved
 * for them, and the ones the pro added. The default comes first. Estimates and invoices pick one.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError!;

    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Customer ID required' }, { status: 400 });
    const customerId = await ownedContactId(id, user.id);
    if (!customerId) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

    const properties = await listContactProperties(createServiceRoleClient(), customerId);
    return NextResponse.json({ properties });
  } catch (err) {
    console.error('GET /api/crm/customers/[id]/places', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/crm/customers/[id]/places
 * Add a property (nickname, type, address) to the contact. Only the pro sees it.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError!;

    const { id } = await params;
    const customerId = id ? await ownedContactId(id, user.id) : null;
    if (!customerId) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

    const parsed = readProPropertyInput(await request.json().catch(() => ({})));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const admin = createServiceRoleClient();
    const existing = await listContactProperties(admin, customerId);
    if (existing.filter((row) => row.addedByPro).length >= MAX_PRO_PROPERTIES) {
      return NextResponse.json({ error: `A contact can hold up to ${MAX_PRO_PROPERTIES} properties.` }, { status: 400 });
    }
    const placeId = await addProProperty(admin, { customerId, ownerId: user.id, input: parsed.input });
    const properties = await listContactProperties(admin, customerId);
    return NextResponse.json({ id: placeId, properties }, { status: 201 });
  } catch (err) {
    console.error('POST /api/crm/customers/[id]/places', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
