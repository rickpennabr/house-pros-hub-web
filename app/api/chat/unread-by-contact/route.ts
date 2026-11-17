import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { getOwnedBusinessId } from '@/lib/auth/ownedBusiness';
import { loadUnreadByContact } from '@/lib/chat/unread-by-contact';

/** GET /api/chat/unread-by-contact → { counts, business, personal } for the ProBot sidebar badges. */
export async function GET() {
  try {
    const session = await createClient();
    const { data: { user } } = await session.auth.getUser();
    if (!user) return NextResponse.json({ counts: {}, business: 0, personal: 0 });
    const businessId = await getOwnedBusinessId(user.id);
    return NextResponse.json(await loadUnreadByContact(createServiceRoleClient(), user.id, businessId));
  } catch (err) {
    console.error('GET /api/chat/unread-by-contact', err);
    return NextResponse.json({ counts: {}, business: 0, personal: 0 });
  }
}
