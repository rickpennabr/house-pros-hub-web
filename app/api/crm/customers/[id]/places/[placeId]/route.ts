import { NextRequest, NextResponse } from 'next/server';
import { requireContractor } from '@/lib/crm/require-contractor';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { listContactProperties, removeProProperty, updateContactProperty } from '@/lib/places/contact-places';
import { readProPropertyInput } from '@/lib/places/pro-property-input';
import { recordPlaceUpdated } from '@/lib/places/timeline';

type Params = { params: Promise<{ id: string; placeId: string }> };

/**
 * PATCH /api/crm/customers/[id]/places/[placeId]
 * Fix a property on the contact: one the pro added, or the customer's My Places house. A change
 * to the customer's house goes on its timeline, so the customer and other pros see who changed it.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError!;
    const { id, placeId } = await params;

    const parsed = readProPropertyInput(await request.json().catch(() => ({})));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const admin = createServiceRoleClient();
    const updated = await updateContactProperty(admin, { customerId: id, ownerId: user.id, placeId, input: parsed.input });
    if (!updated) return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    if (updated.customerOwned) {
      await recordPlaceUpdated({ placeId, ownerId: user.id, customerId: id, changes: updated.changes });
    }
    return NextResponse.json({ properties: await listContactProperties(admin, id) });
  } catch (err) {
    console.error('PATCH /api/crm/customers/[id]/places/[placeId]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/crm/customers/[id]/places/[placeId]
 * Remove a property the pro added. Estimates, invoices and agreements on it move to the default.
 */
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError!;
    const { id, placeId } = await params;

    const admin = createServiceRoleClient();
    const removed = await removeProProperty(admin, { customerId: id, ownerId: user.id, placeId });
    if (!removed) return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    return NextResponse.json({ properties: await listContactProperties(admin, id) });
  } catch (err) {
    console.error('DELETE /api/crm/customers/[id]/places/[placeId]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
