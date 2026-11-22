-- Emoji reactions on chat messages (WhatsApp style): one per side of the chat.
-- {"visitor": "👍", "admin": "❤️"}  visitor = customer/homeowner, admin = the pro (or Hub Agent).
ALTER TABLE public.probot_messages
  ADD COLUMN IF NOT EXISTS reactions jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.probot_messages.reactions IS
  'Emoji reactions: {"visitor": emoji, "admin": emoji}. Written by /api/chat/messages/react.';
