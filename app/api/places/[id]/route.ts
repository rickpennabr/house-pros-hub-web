import { NextRequest, NextResponse } from 'next/server';
import { loadPlaceBundle, PLACE_KINDS, type PlaceKind } from '@/lib/places/portal';
import { cleanText, deny, requirePortalUser } from '@/lib/places/session';

/**
 * GET /api/places/[id]
 * Projects, maintenance, documents, invoices, and estimates published to this place.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, user } = await requirePortalUser();
    if (error || !user) return deny(error);
    const { id } = await params;
    const bundle = await loadPlaceBundle(user.id, id);
    if (!bundle) return NextResponse.json({ error: 'Place not found' }, { status: 404 });
    return NextResponse.json(bundle);
  } catch (err) {
    console.error('GET /api/places/[id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/places/[id]
 * Rename a place or correct its address. The customer owns the place record.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, user, supabase } = await requirePortalUser();
    if (error || !user) return deny(error);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const name = cleanText(body.name, 120);
    const kind = PLACE_KINDS.includes(body.kind) ? (body.kind as PlaceKind) : null;
    if (!kind || !name) {
      return NextResponse.json({ error: 'Name and place type are required.' }, { status: 400 });
    }

    const { error: updateError } = await supabase
      .from('customer_places')
      .update({
        kind,
        name,
        street: cleanText(body.street, 160) || null,
        city: cleanText(body.city, 80) || null,
        state: cleanText(body.state, 2).toUpperCase() || null,
        zip_code: cleanText(body.zipCode, 12) || null,
      })
      .eq('id', id)
      .eq('user_id', user.id);

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/places/[id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/places/[id]
 * Remove a place the customer added. Published work stays on the contractor's CRM.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, user, supabase } = await requirePortalUser();
    if (error || !user) return deny(error);
    const { id } = await params;
    const { error: deleteError } = await supabase.from('customer_places').delete().eq('id', id).eq('user_id', user.id);
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/places/[id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
