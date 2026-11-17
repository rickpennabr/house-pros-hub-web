import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { deleteConversationSchema } from '@/lib/schemas/chat';
import { verifyVisitorDeleteToken } from '@/lib/utils/chatVisitorToken';
import { visitorCookieDenied } from '@/lib/utils/chatVisitorCookie';

/**
 * DELETE /api/chat/conversations/delete
 * Body: { conversationId, visitorId, deleteToken, businessId?, hubOnly? }
 * With businessId (or hubOnly) only that contact's thread is deleted and the conversation stays.
 * Deletes the conversation and its messages only if visitor_id matches
 * and deleteToken was issued for that visitorId.
 */
export async function DELETE(request: NextRequest) {
  const rateLimitRes = await checkRateLimit(request, 'chat');
  if (rateLimitRes) return rateLimitRes;

  try {
    const body = await request.json();
    const parsed = deleteConversationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors?.visitorId?.[0] ?? 'Invalid request' },
        { status: 400 }
      );
    }
    const { conversationId, visitorId, deleteToken, businessId, hubOnly } = parsed.data;
    const cookieDenied = visitorCookieDenied(request, visitorId);
    if (cookieDenied) return cookieDenied;

    if (!verifyVisitorDeleteToken(deleteToken, visitorId)) {
      return NextResponse.json({ error: 'Invalid or expired delete token' }, { status: 403 });
    }

    const supabase = createServiceRoleClient();
    const { data: conv, error: fetchErr } = await supabase
      .from('probot_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('visitor_id', visitorId)
      .single();

    if (fetchErr || !conv) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // One contact's thread: the messages with that pro, or the ProBot (untagged) messages.
    if (businessId || hubOnly) {
      const scoped = supabase.from('probot_messages').delete().eq('conversation_id', conversationId);
      const { error: scopedError } = businessId
        ? await scoped.eq('business_id', businessId)
        : await scoped.is('business_id', null);
      if (scopedError) {
        console.error('ProBot visitor DELETE thread error:', scopedError);
        return NextResponse.json({ error: 'Failed to delete messages' }, { status: 500 });
      }
      return NextResponse.json({ deleted: conversationId, scope: businessId ? 'business' : 'hub' }, { status: 200 });
    }

    const { error: delMsg } = await supabase
      .from('probot_messages')
      .delete()
      .eq('conversation_id', conversationId);
    if (delMsg) {
      console.error('ProBot visitor DELETE messages error:', delMsg);
      return NextResponse.json({ error: 'Failed to delete messages' }, { status: 500 });
    }

    const { error: delConv } = await supabase
      .from('probot_conversations')
      .delete()
      .eq('id', conversationId)
      .eq('visitor_id', visitorId);
    if (delConv) {
      console.error('ProBot visitor DELETE conversation error:', delConv);
      return NextResponse.json({ error: 'Failed to delete conversation' }, { status: 500 });
    }

    return NextResponse.json({ deleted: conversationId }, { status: 200 });
  } catch (e) {
    console.error('ProBot conversations delete error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
