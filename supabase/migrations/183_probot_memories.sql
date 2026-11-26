-- ProBot memory: short facts a signed-in person told ProBot ("crew starts at 6am", "has a pool"),
-- kept per side (personal or business) and added to later chats. They can ask ProBot to forget one.
CREATE TABLE IF NOT EXISTS public.probot_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  profile_mode TEXT NOT NULL DEFAULT 'personal' CHECK (profile_mode IN ('personal', 'business')),
  fact TEXT NOT NULL CHECK (char_length(btrim(fact)) BETWEEN 3 AND 200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_probot_memories_user ON public.probot_memories (user_id, profile_mode, created_at DESC);

ALTER TABLE public.probot_memories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role only for probot memories" ON public.probot_memories;
CREATE POLICY "Service role only for probot memories"
  ON public.probot_memories FOR ALL
  USING (false)
  WITH CHECK (false);
