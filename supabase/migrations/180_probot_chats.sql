-- ProBot chats (Gemini-style): one person can keep several chats with ProBot, separate per profile
-- (personal, or each business they run). Messages to pros are not in these chats.
CREATE TABLE IF NOT EXISTS public.probot_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.probot_conversations(id) ON DELETE CASCADE,
  title TEXT CHECK (title IS NULL OR char_length(title) <= 120),
  -- 'personal' or the business id the chat belongs to.
  profile_key TEXT NOT NULL DEFAULT 'personal' CHECK (char_length(profile_key) <= 64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_probot_chats_conversation
  ON public.probot_chats (conversation_id, profile_key, updated_at DESC);

ALTER TABLE public.probot_chats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role only for probot chats" ON public.probot_chats;
CREATE POLICY "Service role only for probot chats"
  ON public.probot_chats FOR ALL
  USING (false)
  WITH CHECK (false);

-- Null = the single ProBot thread from before chats ("Earlier chat").
ALTER TABLE public.probot_messages
  ADD COLUMN IF NOT EXISTS chat_id UUID REFERENCES public.probot_chats(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_probot_messages_chat ON public.probot_messages (chat_id, created_at);
