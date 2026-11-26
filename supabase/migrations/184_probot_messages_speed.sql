-- ProBot speed: opening a chat reads the newest messages of a conversation, and the badges poll
-- unread messages every few seconds. Both get an index that matches the query. Safe to run again.

CREATE INDEX IF NOT EXISTS idx_probot_messages_conv_created
  ON public.probot_messages (conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_probot_messages_unread
  ON public.probot_messages (conversation_id, sender)
  WHERE read_at IS NULL;

ANALYZE public.probot_messages;
