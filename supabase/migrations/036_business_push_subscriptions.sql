-- Table: business_push_subscriptions (Web Push for contractors/business owners)
-- When a visitor messages a business, the business owner receives a push notification.
CREATE TABLE IF NOT EXISTS public.business_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  UNIQUE(endpoint)
);
CREATE INDEX IF NOT EXISTS idx_business_push_subscriptions_user_id ON public.business_push_subscriptions(user_id);
ALTER TABLE public.business_push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own business push subscriptions"
  ON public.business_push_subscriptions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.business_push_subscriptions IS 'Web Push subscriptions for business (contractor) notifications when visitors message their business.';
