import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { createConversationSchema } from '@/lib/schemas/chat';

/**
 * POST /api/chat/conversations
 * Ensure a conversation exists for the given visitorId; return conversationId.
 * Used by visitor client before or when sending first message.
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

    const supabase = createServiceRoleClient();
    const { data: existing } = await supabase
      .from('probot_conversations')
      .select('id')
      .eq('visitor_id', visitorId)
      .single();

    if (existing) {
      return NextResponse.json({ conversationId: existing.id }, { status: 200 });
    }

    const { data: inserted, error } = await supabase
      .from('probot_conversations')
      .insert({ visitor_id: visitorId })
      .select('id')
      .single();

    if (error) {
      console.error('ProBot conversation insert error:', error);
      return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
    }
    return NextResponse.json({ conversationId: inserted.id }, { status: 200 });
  } catch (e) {
    console.error('ProBot conversations POST error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
