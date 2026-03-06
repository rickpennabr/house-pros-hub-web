-- Link conversation to authenticated user so admin can show profile name and picture.
ALTER TABLE public.probot_conversations
  ADD COLUMN IF NOT EXISTS user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_probot_conversations_user_id ON public.probot_conversations(user_id) WHERE user_id IS NOT NULL;

COMMENT ON COLUMN public.probot_conversations.user_id IS 'Set when an authenticated user sends a message; used to show profile first_name, last_name, user_picture in admin History Chat.';
