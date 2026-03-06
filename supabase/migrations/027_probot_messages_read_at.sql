-- Read receipt: when the other party views the conversation, we set read_at on their messages.
ALTER TABLE public.probot_messages
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_probot_messages_read_at ON public.probot_messages(read_at) WHERE read_at IS NOT NULL;

COMMENT ON COLUMN public.probot_messages.read_at IS 'Set when the recipient has viewed the conversation (admin viewing marks visitor messages, visitor viewing marks admin messages).';
