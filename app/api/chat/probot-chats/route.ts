import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { visitorCookieDenied } from '@/lib/utils/chatVisitorCookie';
import { visitorOwnsConversation } from '@/lib/chat/resolveConversation';
import { isMissingColumnError } from '@/lib/chat/probot-reply';

/**
 * ProBot chats (Gemini-style): list, start, rename and delete the person's chats with ProBot,
 * one list per profile (personal or a business). Owner = the visitor cookie or the signed-in user.
 */

const profileKey = z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/);
const base = z.object({ conversationId: z.string().uuid(), visitorId: z.string().trim().min(1).max(100) });

export interface ProbotChatRow {
  id: string;
  title: string | null;
  updated_at: string;
  /** The single thread from before chats existed. */
  legacy?: boolean;
}

async function authorize(request: NextRequest, conversationId: string, visitorId: string) {
  const denied = visitorCookieDenied(request, visitorId);
  if (denied) return { denied };
  const supabase = createServiceRoleClient();
  const owns = await visitorOwnsConversation(supabase, conversationId, visitorId);
  if (!owns) return { denied: NextResponse.json({ error: 'Conversation not found' }, { status: 404 }) };
  return { supabase };
}

/** Before migration 180 there are no chats: say so, and the app keeps the single thread. */
function notReady(error: { code?: string; message?: string } | null) {
  return Boolean(error && (isMissingColumnError(error) || error.code === '42P01' || /probot_chats/.test(error.message ?? '')));
}

export async function GET(request: NextRequest) {
  const limited = await checkRateLimit(request, 'chatRead');
  if (limited) return limited;
  const params = request.nextUrl.searchParams;
  const parsed = base.extend({ profile: profileKey }).safeParse({
    conversationId: params.get('conversationId'),
    visitorId: params.get('visitorId'),
    profile: params.get('profile') ?? 'personal',
  });
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const auth = await authorize(request, parsed.data.conversationId, parsed.data.visitorId);
  if (auth.denied) return auth.denied;
  const { supabase } = auth;

  const { data, error } = await supabase
    .from('probot_chats')
    .select('id, title, updated_at')
    .eq('conversation_id', parsed.data.conversationId)
    .eq('profile_key', parsed.data.profile)
    .order('updated_at', { ascending: false })
    .limit(100);
  if (notReady(error)) return NextResponse.json({ chats: [], ready: false });
  if (error) return NextResponse.json({ error: 'Failed to load chats' }, { status: 500 });

  const chats: ProbotChatRow[] = (data ?? []) as ProbotChatRow[];
  // ProBot messages from before chats: shown as "Earlier chat" (personal list only).
  if (parsed.data.profile === 'personal') {
    const { data: legacy } = await supabase
      .from('probot_messages')
      .select('created_at')
      .eq('conversation_id', parsed.data.conversationId)
      .is('business_id', null)
      .is('chat_id', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (legacy) {
      chats.push({ id: 'legacy', title: null, updated_at: (legacy as { created_at: string }).created_at, legacy: true });
    }
  }
  return NextResponse.json({ chats, ready: true });
}

export async function POST(request: NextRequest) {
  const limited = await checkRateLimit(request, 'chat');
  if (limited) return limited;
  const parsed = base.extend({ profile: profileKey }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const auth = await authorize(request, parsed.data.conversationId, parsed.data.visitorId);
  if (auth.denied) return auth.denied;
  const { data, error } = await auth.supabase
    .from('probot_chats')
    .insert({ conversation_id: parsed.data.conversationId, profile_key: parsed.data.profile })
    .select('id, title, updated_at')
    .single();
  if (notReady(error)) return NextResponse.json({ chat: null, ready: false });
  if (error || !data) return NextResponse.json({ error: 'Failed to start chat' }, { status: 500 });
  return NextResponse.json({ chat: data });
}

export async function PATCH(request: NextRequest) {
  const limited = await checkRateLimit(request, 'chat');
  if (limited) return limited;
  const parsed = base
    .extend({ chatId: z.string().uuid(), title: z.string().trim().min(1).max(120) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const auth = await authorize(request, parsed.data.conversationId, parsed.data.visitorId);
  if (auth.denied) return auth.denied;
  const { error } = await auth.supabase
    .from('probot_chats')
    .update({ title: parsed.data.title })
    .eq('id', parsed.data.chatId)
    .eq('conversation_id', parsed.data.conversationId);
  if (error) return NextResponse.json({ error: 'Failed to rename' }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const limited = await checkRateLimit(request, 'chat');
  if (limited) return limited;
  const params = request.nextUrl.searchParams;
  const parsed = base.extend({ chatId: z.union([z.string().uuid(), z.literal('legacy')]) }).safeParse({
    conversationId: params.get('conversationId'),
    visitorId: params.get('visitorId'),
    chatId: params.get('chatId'),
  });
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const auth = await authorize(request, parsed.data.conversationId, parsed.data.visitorId);
  if (auth.denied) return auth.denied;
  const { supabase } = auth;
  const { error } =
    parsed.data.chatId === 'legacy'
      ? await supabase
          .from('probot_messages')
          .delete()
          .eq('conversation_id', parsed.data.conversationId)
          .is('business_id', null)
          .is('chat_id', null)
      : await supabase
          .from('probot_chats')
          .delete()
          .eq('id', parsed.data.chatId)
          .eq('conversation_id', parsed.data.conversationId);
  if (error) return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
