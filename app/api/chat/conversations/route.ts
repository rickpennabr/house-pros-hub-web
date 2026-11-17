import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { createConversationSchema } from '@/lib/schemas/chat';
import { visitorCookieDenied } from '@/lib/utils/chatVisitorCookie';
import { resolveVisitorConversation } from '@/lib/chat/resolveConversation';

/**
 * POST /api/chat/conversations
 * Ensure a conversation exists for the given visitorId; return conversationId.
 * Signed-in customers reuse the thread linked to their account so history is kept.
 */
export async function POST(request: NextRequest) {
  const rateLimitRes = await checkRateLimit(request, 'chat');
  if (rateLimitRes) return rateLimitRes;

  try {
    const body = await request.json();
    const parsed = createConversationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors?.visitorId?.[0] ?? 'Invalid request' },
        { status: 400 }
      );
    }
    const { visitorId } = parsed.data;
    const cookieDenied = visitorCookieDenied(request, visitorId);
    if (cookieDenied) return cookieDenied;

    const supabase = createServiceRoleClient();
    const { conversationId } = await resolveVisitorConversation(supabase, visitorId);
    return NextResponse.json({ conversationId }, { status: 200 });
  } catch (e) {
    console.error('ProBot conversations POST error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
