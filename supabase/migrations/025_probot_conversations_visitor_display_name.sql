-- Optional display name for the visitor (e.g. set when they sign up or provide name in chat).
-- Admin History Chat uses this for "real customer name" when present.
ALTER TABLE public.probot_conversations
  ADD COLUMN IF NOT EXISTS visitor_display_name TEXT NULL;

COMMENT ON COLUMN public.probot_conversations.visitor_display_name IS 'Display name for the visitor when known (e.g. from signup or when sent with a message).';
