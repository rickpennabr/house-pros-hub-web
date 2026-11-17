import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { getOwnedBusinessId } from '@/lib/auth/ownedBusiness';

/**
 * DELETE /api/chat/contractor/conversations/delete?conversationId=…
 * A pro removes a chat from their inbox: deletes the messages between this customer (or visitor)
 * and the pro's business. The customer's ProBot and other pros' messages are left alone.
 */
export async function DELETE(request: NextRequest) {
  const rateLimitRes = await checkRateLimit(request, 'chat');
  if (rateLimitRes) return rateLimitRes;

  try {
    const session = await createClient();
    const { data: { user } } = await session.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const businessId = await getOwnedBusinessId(user.id);
    if (!businessId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const conversationId = request.nextUrl.searchParams.get('conversationId') ?? '';
    if (!/^[0-9a-f-]{36}$/i.test(conversationId)) {
      return NextResponse.json({ error: 'conversationId is required' }, { status: 400 });
    }

    const db = createServiceRoleClient();
    // The inbox merges every conversation of the same visitor, so clear them all.
    const { data: conversation } = await db
      .from('probot_conversations')
      .select('visitor_id')
      .eq('id', conversationId)
      .maybeSingle();
    if (!conversation) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });

    const { data: related } = await db
      .from('probot_conversations')
      .select('id')
      .eq('visitor_id', conversation.visitor_id);
    const ids = (related ?? []).map((row) => row.id);
    if (!ids.includes(conversationId)) ids.push(conversationId);

    const { count } = await db
      .from('probot_messages')
      .select('id', { count: 'exact', head: true })
      .in('conversation_id', ids)
      .eq('business_id', businessId);
    if (!count) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });

    const { error } = await db
      .from('probot_messages')
      .delete()
      .in('conversation_id', ids)
      .eq('business_id', businessId);
    if (error) {
      console.error('Contractor conversation DELETE error:', error);
      return NextResponse.json({ error: 'Failed to delete conversation' }, { status: 500 });
    }
    return NextResponse.json({ deleted: conversationId, messages: count });
  } catch (err) {
    console.error('DELETE /api/chat/contractor/conversations/delete', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
