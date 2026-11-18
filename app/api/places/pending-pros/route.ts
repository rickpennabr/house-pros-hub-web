import { NextRequest, NextResponse } from 'next/server';
import { approvePendingPro, listPendingPros } from '@/lib/places/portal';
import { cleanText, deny, requirePortalUser } from '@/lib/places/session';

/**
 * POST /api/places/pending-pros
 * The customer puts a pro that has them in its CRM on one of their places.
 * Body: { ownerId, placeId }. Nothing is linked to a place until the customer does this.
 */
export async function POST(request: NextRequest) {
  try {
    const { error, user } = await requirePortalUser();
    if (error || !user) return deny(error);

    const body = await request.json().catch(() => ({}));
    const ownerId = cleanText(body.ownerId, 64);
    const placeId = cleanText(body.placeId, 64);
    if (!ownerId || !placeId) {
      return NextResponse.json({ error: 'Choose a place for this professional.' }, { status: 400 });
    }

    const pending = await listPendingPros(user.id);
    if (!pending.some((pro) => pro.ownerId === ownerId)) {
      return NextResponse.json({ error: 'This professional is not waiting for a place.' }, { status: 404 });
    }
    const linked = await approvePendingPro(user.id, ownerId, placeId);
    if (!linked) return NextResponse.json({ error: 'Choose one of your places.' }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/places/pending-pros', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
