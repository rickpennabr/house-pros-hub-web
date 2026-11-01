import { NextRequest, NextResponse } from 'next/server';
import { claimPortalCustomers, listPortalPlaces, PLACE_KINDS, type PlaceKind } from '@/lib/places/portal';
import { cleanText, deny, requirePortalUser } from '@/lib/places/session';

/**
 * GET /api/places
 * The signed-in customer's houses, businesses, and buildings.
 * Claims CRM work that uses their confirmed email.
 */
export async function GET() {
  try {
    const { error, user } = await requirePortalUser();
    if (error || !user) return deny(error);

    await claimPortalCustomers(user);
    const places = await listPortalPlaces(user.id);
    return NextResponse.json({
      places,
      emailConfirmed: Boolean(user.email_confirmed_at),
    });
  } catch (err) {
    console.error('GET /api/places', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/places
 * Add a house, business, or building for the signed-in customer.
 */
export async function POST(request: NextRequest) {
  try {
    const { error, user, supabase } = await requirePortalUser();
    if (error || !user) return deny(error);

    const body = await request.json().catch(() => ({}));
    const kind = PLACE_KINDS.includes(body.kind) ? (body.kind as PlaceKind) : null;
    const name = cleanText(body.name, 120);
    if (!kind || !name) {
      return NextResponse.json({ error: 'Choose a house, business, or building, and give it a name.' }, { status: 400 });
    }

    const { data, error: insertError } = await supabase
      .from('customer_places')
      .insert({
        user_id: user.id,
        kind,
        name,
        street: cleanText(body.street, 160) || null,
        city: cleanText(body.city, 80) || null,
        state: cleanText(body.state, 2).toUpperCase() || null,
        zip_code: cleanText(body.zipCode, 12) || null,
      })
      .select('id')
      .single();

    if (insertError || !data) {
      return NextResponse.json({ error: insertError?.message || 'Could not add the place' }, { status: 500 });
    }
    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (err) {
    console.error('POST /api/places', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
