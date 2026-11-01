-- One row per ProBot model attempt. The visitor's message is not stored.

CREATE TABLE IF NOT EXISTS public.probot_reply_traces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.probot_conversations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  playbook_attached BOOLEAN NOT NULL,
  latency_ms INTEGER NOT NULL CHECK (latency_ms >= 0),
  outcome TEXT NOT NULL CHECK (outcome IN ('model', 'fallback')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);

CREATE INDEX IF NOT EXISTS idx_probot_reply_traces_conversation
  ON public.probot_reply_traces (conversation_id, created_at DESC);

ALTER TABLE public.probot_reply_traces ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.probot_reply_traces FROM anon, authenticated;

COMMENT ON TABLE public.probot_reply_traces IS
  'Model reply metadata only. No policies: the service role inserts. Do not store the visitor message.';
