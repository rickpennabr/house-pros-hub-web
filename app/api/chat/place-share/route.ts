import { NextRequest, NextResponse } from 'next/server';
import { requireCrmScope } from '@/lib/crm/crm-scope';
import { parseAgentPayload } from '@/lib/chat/proagent-policy';
import type { ChatPlaceShare } from '@/lib/types/chat';

/**
 * POST /api/chat/place-share  { messageId } or { conversationId }
 * The pro adds the customer from a chat to their CRM. When the customer shared a My Places
 * property (the message, or the latest share in the conversation), that place is linked, so the
 * pro's projects, estimates, invoices and maintenance show on the customer's My Places.
 */
export async function POST(request: NextRequest) {
  try {
    const { error: scopeError, scope } = await requireCrmScope();
    if (scopeError) return scopeError;
    if (scope.isCrew) return NextResponse.json({ error: 'Only the business owner can add customers.' }, { status: 403 });
    if (!scope.businessId) return NextResponse.json({ error: 'Business not found' }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const messageId = typeof body.messageId === 'string' ? body.messageId : '';
    const requestedConversationId = typeof body.conversationId === 'string' ? body.conversationId : '';
    const db = scope.supabase;

    type ShareMessage = { id: string; conversation_id: string; business_id: string | null; payload: unknown };
    let conversationId = '';
    let shareMessage: ShareMessage | null = null;
    let share: ChatPlaceShare | undefined;

    if (messageId) {
      const { data } = await db
        .from('probot_messages')
        .select('id, conversation_id, business_id, payload')
        .eq('id', messageId)
        .maybeSingle();
      if (!data || data.business_id !== scope.businessId) {
        return NextResponse.json({ error: 'Shared place not found' }, { status: 404 });
      }
      shareMessage = data;
      conversationId = data.conversation_id;
      share = parseAgentPayload(data.payload)?.placeShare;
    } else if (requestedConversationId) {
      // The conversation must be one this business is part of.
      const { data: anyRow } = await db
        .from('probot_messages')
        .select('id')
        .eq('conversation_id', requestedConversationId)
        .eq('business_id', scope.businessId)
        .limit(1)
        .maybeSingle();
      if (!anyRow) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
      conversationId = requestedConversationId;

      const { data: shares } = await db
        .from('probot_messages')
        .select('id, conversation_id, business_id, payload')
        .eq('conversation_id', conversationId)
        .eq('business_id', scope.businessId)
        .eq('sender', 'visitor')
        .not('payload', 'is', null)
        .order('created_at', { ascending: false })
        .limit(20);
      for (const row of shares ?? []) {
        const parsed = parseAgentPayload(row.payload)?.placeShare;
        if (parsed) {
          shareMessage = row;
          share = parsed;
          break;
        }
      }
    } else {
      return NextResponse.json({ error: 'messageId or conversationId is required' }, { status: 400 });
    }

    if (share?.crmCustomerId) return NextResponse.json({ customerId: share.crmCustomerId, placeLinked: true });

    const { data: conversation } = await db
      .from('probot_conversations')
      .select('user_id')
      .eq('id', conversationId)
      .maybeSingle();
    const customerUserId = conversation?.user_id;
    if (!customerUserId) {
      return NextResponse.json({ error: 'This customer has no account yet, so they cannot be linked.' }, { status: 404 });
    }

    let place: { id: string; street: string | null; city: string | null; state: string | null; zip_code: string | null } | null = null;
    if (share) {
      const { data } = await db
        .from('customer_places')
        .select('id, street, city, state, zip_code')
        .eq('id', share.placeId)
        .eq('user_id', customerUserId)
        .maybeSingle();
      place = data;
    }

    const [{ data: profile }, { data: authUser }] = await Promise.all([
      db.from('profiles').select('first_name, last_name, phone').eq('id', customerUserId).maybeSingle(),
      db.auth.admin.getUserById(customerUserId),
    ]);
    const email = authUser?.user?.email ?? null;

    // Reuse this customer's CRM record (same place first, then same account) before creating one.
    const { data: existing } = await db
      .from('pro_crm_customers')
      .select('id, place_id, portal_user_id')
      .eq('owner_id', scope.ownerId)
      .or(place ? `place_id.eq.${place.id},portal_user_id.eq.${customerUserId}` : `portal_user_id.eq.${customerUserId}`)
      .order('created_at', { ascending: true });
    const match =
      (place ? existing?.find((row) => row.place_id === place!.id) : undefined) ??
      existing?.find((row) => !row.place_id) ??
      (place ? undefined : existing?.[0]) ??
      null;

    let customerId: string;
    if (match) {
      const { error } = await db
        .from('pro_crm_customers')
        .update(place ? { portal_user_id: customerUserId, place_id: place.id } : { portal_user_id: customerUserId })
        .eq('id', match.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      customerId = match.id;
    } else {
      const { data: created, error } = await db
        .from('pro_crm_customers')
        .insert({
          owner_id: scope.ownerId,
          first_name: profile?.first_name?.trim() || 'Customer',
          last_name: profile?.last_name?.trim() || '',
          email,
          phone: profile?.phone ?? null,
          street_address: place?.street ?? null,
          city: place?.city ?? null,
          state: place?.state ?? null,
          zip_code: place?.zip_code ?? null,
          portal_user_id: customerUserId,
          place_id: place?.id ?? null,
        })
        .select('id')
        .single();
      if (error || !created) return NextResponse.json({ error: error?.message || 'Could not add customer' }, { status: 500 });
      customerId = created.id;
    }

    if (shareMessage && share && place) {
      await db
        .from('probot_messages')
        .update({
          payload: {
            ...((shareMessage.payload as Record<string, unknown>) ?? {}),
            placeShare: { ...share, crmCustomerId: customerId },
          },
        })
        .eq('id', shareMessage.id);
    }

    if (place) {
      // Tell both sides in the chat. The bubble renders this payload in the viewer's language.
      const placeName = share?.name || 'your place';
      const { error: noticeError } = await db.from('probot_messages').insert({
        conversation_id: conversationId,
        sender: 'admin',
        body: `Added ${placeName} to my customers. My estimates, invoices and visits will show in your My Places.`,
        business_id: scope.businessId,
        admin_user_id: scope.ownerId,
        payload: { placeLinked: { placeId: place.id, name: placeName } },
      });
      if (noticeError) console.error('place-share notice insert', noticeError);
    }

    return NextResponse.json({ customerId, placeLinked: Boolean(place), messageId: shareMessage?.id ?? null });
  } catch (err) {
    console.error('POST /api/chat/place-share', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
