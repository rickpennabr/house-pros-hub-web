-- ProAgent: structured chat cards, a step audit, and a pause when a person takes the thread.

ALTER TABLE public.probot_conversations
  ADD COLUMN IF NOT EXISTS agent_paused_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.probot_conversations.agent_paused_at IS
  'Set when a Hub Agent replies. ProAgent stays quiet until an admin clears it.';

ALTER TABLE public.probot_messages
  ADD COLUMN IF NOT EXISTS payload JSONB;

COMMENT ON COLUMN public.probot_messages.payload IS
  'ProAgent cards (pros, confirm). The visitor text stays in body. Do not put the model prompt here.';

CREATE TABLE IF NOT EXISTS public.probot_agent_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.probot_conversations(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.probot_messages(id) ON DELETE SET NULL,
  step_index INTEGER NOT NULL CHECK (step_index >= 0),
  tool_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ok', 'needs_confirm', 'confirmed', 'failed', 'fallback')),
  latency_ms INTEGER NOT NULL DEFAULT 0 CHECK (latency_ms >= 0),
  input JSONB,
  output JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS idx_probot_agent_steps_conversation
  ON public.probot_agent_steps (conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_probot_agent_steps_message
  ON public.probot_agent_steps (message_id);

ALTER TABLE public.probot_agent_steps ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.probot_agent_steps FROM anon, authenticated;

COMMENT ON TABLE public.probot_agent_steps IS
  'One row per ProAgent tool call. Service role only. A needs_confirm row holds the draft until the homeowner taps Confirm.';

CREATE UNIQUE INDEX IF NOT EXISTS agent_apps_proagent_name
  ON public.agent_apps (name)
  WHERE name = 'ProAgent' AND revoked_at IS NULL;
