import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { adminSendMessageSchema } from '@/lib/schemas/chat';
import { ADMIN_EMAIL } from '@/lib/constants/admin';

/**
 * POST /api/chat/admin/messages
 * Admin sends a reply in a conversation.
 */
export async function POST(request: NextRequest) {
  const rateLimitRes = await checkRateLimit(request, 'chat');
  if (rateLimitRes) return rateLimitRes;

  try {
    const supabaseAuth = await createClient();
    const {
      data: { session },
      error: sessionError,
    } = await supabaseAuth.auth.getSession();

    if (sessionError || !session?.user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const isAdmin =
      session.user.email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = adminSendMessageSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.flatten().fieldErrors?.body?.[0] ?? 'Invalid request';
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const { conversationId, body: messageBody } = parsed.data;

    const supabase = createServiceRoleClient();
    const { data: message, error } = await supabase
      .from('probot_messages')
      .insert({
        conversation_id: conversationId,
        sender: 'admin',
        body: messageBody,
      })
      .select('id, conversation_id, sender, body, created_at')
      .single();

    if (error) {
      console.error('ProBot admin message insert error:', error);
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
    }

    return NextResponse.json(
      { message: { id: message.id, conversationId: message.conversation_id, sender: message.sender, body: message.body, created_at: message.created_at } },
      { status: 200 }
    );
  } catch (e) {
    console.error('ProBot admin messages POST error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
