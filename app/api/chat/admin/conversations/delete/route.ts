import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { adminDeleteConversationQuerySchema } from '@/lib/schemas/chat';
import { ADMIN_EMAIL } from '@/lib/constants/admin';

/**
 * DELETE /api/chat/admin/conversations/delete?conversationId=...
 * Admin only. Deletes one conversation (and its messages). conversationId is required.
 */
export async function DELETE(request: NextRequest) {
  const rateLimitRes = await checkRateLimit(request, 'chat');
  if (rateLimitRes) return rateLimitRes;

  try {
    const supabaseAuth = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser();
    if (userError || !user?.email) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const isAdmin = user.email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const parsed = adminDeleteConversationQuerySchema.safeParse({
      conversationId: searchParams.get('conversationId') ?? undefined,
    });
    if (!parsed.success) {
      const msg = parsed.error.flatten().fieldErrors?.conversationId?.[0] ?? 'conversationId is required';
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const { conversationId } = parsed.data;

    const supabase = createServiceRoleClient();
    const { error: delMsg } = await supabase
      .from('probot_messages')
      .delete()
      .eq('conversation_id', conversationId);
    if (delMsg) {
      console.error('ProBot admin DELETE messages error:', delMsg);
      return NextResponse.json({ error: 'Failed to delete messages' }, { status: 500 });
    }
    const { error: delConv } = await supabase
      .from('probot_conversations')
      .delete()
      .eq('id', conversationId);
    if (delConv) {
      console.error('ProBot admin DELETE conversation error:', delConv);
      return NextResponse.json({ error: 'Failed to delete conversation' }, { status: 500 });
    }
    return NextResponse.json({ deleted: conversationId }, { status: 200 });
  } catch (e) {
    console.error('ProBot admin conversations DELETE error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
