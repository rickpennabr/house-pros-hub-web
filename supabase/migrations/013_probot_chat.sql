-- ============================================
-- Migration 013: ProBot Chat and Admin Notifications
-- ============================================
-- Tables: probot_conversations, probot_messages, admin_users, admin_push_subscriptions
-- RLS and Realtime enabled on probot_messages for admin live updates.
-- ============================================

-- Table: admin_users (identifies admin for RLS; sync from ADMIN_EMAIL in app)
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
-- Only service role or the admin themselves can manage; no anon access
CREATE POLICY "Admin users are readable by authenticated"
  ON public.admin_users FOR SELECT
  USING (auth.uid() = user_id);

-- Table: probot_conversations (one per visitor)
CREATE TABLE IF NOT EXISTS public.probot_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);
CREATE INDEX IF NOT EXISTS idx_probot_conversations_visitor_id ON public.probot_conversations(visitor_id);
CREATE INDEX IF NOT EXISTS idx_probot_conversations_updated_at ON public.probot_conversations(updated_at DESC);
ALTER TABLE public.probot_conversations ENABLE ROW LEVEL SECURITY;
-- API uses service role; no direct anon/authenticated access needed for conversations
CREATE POLICY "Service role only for conversations"
  ON public.probot_conversations FOR ALL
  USING (false)
  WITH CHECK (false);

-- Table: probot_messages
CREATE TABLE IF NOT EXISTS public.probot_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.probot_conversations(id) ON DELETE CASCADE,
  sender TEXT NOT NULL CHECK (sender IN ('visitor', 'admin')),
  body TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
);
CREATE INDEX IF NOT EXISTS idx_probot_messages_conversation_id ON public.probot_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_probot_messages_created_at ON public.probot_messages(created_at ASC);
ALTER TABLE public.probot_messages ENABLE ROW LEVEL SECURITY;
-- Admin (in admin_users) can SELECT all messages for Realtime
CREATE POLICY "Admin can select all probot messages"
  ON public.probot_messages FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
  );
-- Insert/update/delete only via service role (API)
CREATE POLICY "No direct insert update delete for anon auth"
  ON public.probot_messages FOR ALL
  USING (false)
  WITH CHECK (false);

-- Trigger to update conversation updated_at when a message is added
CREATE OR REPLACE FUNCTION update_probot_conversation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.probot_conversations
  SET updated_at = TIMEZONE('utc'::text, NOW())
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER probot_messages_update_conversation
  AFTER INSERT ON public.probot_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_probot_conversation_updated_at();

-- Enable Realtime for probot_messages (admin UI subscribes)
ALTER PUBLICATION supabase_realtime ADD TABLE public.probot_messages;

-- Table: admin_push_subscriptions (Web Push)
CREATE TABLE IF NOT EXISTS public.admin_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  UNIQUE(endpoint)
);
CREATE INDEX IF NOT EXISTS idx_admin_push_subscriptions_user_id ON public.admin_push_subscriptions(user_id);
ALTER TABLE public.admin_push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage own push subscriptions"
  ON public.admin_push_subscriptions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.probot_conversations IS 'One conversation per anonymous visitor (visitor_id from localStorage).';
COMMENT ON TABLE public.probot_messages IS 'ProBot chat messages; Realtime enabled for admin.';
COMMENT ON TABLE public.admin_users IS 'User IDs that are admin (synced from ADMIN_EMAIL in app).';
COMMENT ON TABLE public.admin_push_subscriptions IS 'Web Push subscriptions for admin notifications.';
