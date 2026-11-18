import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { getOwnedBusinessId } from '@/lib/auth/ownedBusiness';
import { loadUnreadByContact } from '@/lib/chat/unread-by-contact';
import { loadContactActivity } from '@/lib/chat/contact-activity';

/** GET /api/chat/unread-by-contact → { counts, business, personal, latest } for the ProBot sidebar badges and order. */
export async function GET() {
  try {
    const session = await createClient();
    const { data: { user } } = await session.auth.getUser();
    if (!user) return NextResponse.json({ counts: {}, business: 0, personal: 0, latest: {} });
    const businessId = await getOwnedBusinessId(user.id);
    const db = createServiceRoleClient();
    const [unread, latest] = await Promise.all([
      loadUnreadByContact(db, user.id, businessId),
      loadContactActivity(db, user.id, businessId),
    ]);
    return NextResponse.json({ ...unread, latest });
  } catch (err) {
    console.error('GET /api/chat/unread-by-contact', err);
    return NextResponse.json({ counts: {}, business: 0, personal: 0, latest: {} });
  }
}
