-- Enable RLS on visitor_push_subscriptions (required for public schema exposure).
-- All access is via Next.js API using service role; no direct anon/authenticated access.
ALTER TABLE public.visitor_push_subscriptions ENABLE ROW LEVEL SECURITY;

-- No permissive policies: block direct PostgREST access (anon/authenticated).
-- Service role bypasses RLS, so API and push notification service continue to work.
CREATE POLICY "Service role only for visitor push subscriptions"
  ON public.visitor_push_subscriptions FOR ALL
  USING (false)
  WITH CHECK (false);
