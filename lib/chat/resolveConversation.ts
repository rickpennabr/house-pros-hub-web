import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

type Service = ReturnType<typeof createServiceRoleClient>;

/**
 * Resolve the chat thread for a visitor cookie.
 * Signed-in customers keep one thread by user_id so history survives visitor-id rotation.
 */
export async function resolveVisitorConversation(
  supabase: Service,
  visitorId: string
): Promise<{ conversationId: string; created: boolean }> {
  let authUserId: string | null = null;
  try {
    const session = await createClient();
    const {
      data: { user },
    } = await session.auth.getUser();
    authUserId = user?.id ?? null;
  } catch {
    authUserId = null;
  }

  if (authUserId) {
    const { data: byUser } = await supabase
      .from('probot_conversations')
      .select('id, visitor_id')
      .eq('user_id', authUserId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (byUser?.id) {
      if (byUser.visitor_id !== visitorId) {
        // Reclaim the current cookie on the account thread. Merge any orphan cookie thread into it.
        const { data: orphan } = await supabase
          .from('probot_conversations')
          .select('id')
          .eq('visitor_id', visitorId)
          .maybeSingle();
        if (orphan?.id && orphan.id !== byUser.id) {
          await supabase
            .from('probot_messages')
            .update({ conversation_id: byUser.id })
            .eq('conversation_id', orphan.id);
          await supabase.from('probot_conversations').delete().eq('id', orphan.id);
        }
        await supabase
          .from('probot_conversations')
          .update({ visitor_id: visitorId })
          .eq('id', byUser.id);
      }
      return { conversationId: byUser.id, created: false };
    }
  }

  const { data: byVisitor } = await supabase
    .from('probot_conversations')
    .select('id')
    .eq('visitor_id', visitorId)
    .maybeSingle();

  if (byVisitor?.id) {
    if (authUserId) {
      await supabase
        .from('probot_conversations')
        .update({ user_id: authUserId })
        .eq('id', byVisitor.id)
        .is('user_id', null);
    }
    return { conversationId: byVisitor.id, created: false };
  }

  const insertPayload: { visitor_id: string; user_id?: string } = { visitor_id: visitorId };
  if (authUserId) insertPayload.user_id = authUserId;

  const { data: inserted, error } = await supabase
    .from('probot_conversations')
    .insert(insertPayload)
    .select('id')
    .single();

  if (error || !inserted) {
    throw new Error(error?.message || 'Failed to create conversation');
  }
  return { conversationId: inserted.id, created: true };
}

/** True when this visitor cookie or signed-in account owns the conversation. */
export async function visitorOwnsConversation(
  supabase: Service,
  conversationId: string,
  visitorId: string
): Promise<boolean> {
  const { data: conv } = await supabase
    .from('probot_conversations')
    .select('id, visitor_id, user_id')
    .eq('id', conversationId)
    .maybeSingle();
  if (!conv) return false;
  if (conv.visitor_id === visitorId) return true;

  try {
    const session = await createClient();
    const {
      data: { user },
    } = await session.auth.getUser();
    if (user?.id && conv.user_id === user.id) {
      if (conv.visitor_id !== visitorId) {
        await supabase
          .from('probot_conversations')
          .update({ visitor_id: visitorId })
          .eq('id', conv.id);
      }
      return true;
    }
  } catch {
    // guest
  }
  return false;
}
