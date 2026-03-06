-- Table: visitor_push_subscriptions (Web Push for customers/visitors)
-- When a contractor or admin replies in a conversation, the visitor receives a push notification.
CREATE TABLE IF NOT EXISTS public.visitor_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.probot_conversations(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  UNIQUE(endpoint)
);
CREATE INDEX IF NOT EXISTS idx_visitor_push_subscriptions_conversation_id ON public.visitor_push_subscriptions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_visitor_push_subscriptions_visitor_id ON public.visitor_push_subscriptions(visitor_id);

COMMENT ON TABLE public.visitor_push_subscriptions IS 'Web Push subscriptions for visitor/customer notifications when contractor or admin replies in ProBot chat.';
