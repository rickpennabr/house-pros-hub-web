-- Notification badges and extra timeline steps.

-- When each person last looked at something ("scope"), e.g.
--   place:<placeId>:<tab>                    homeowner, one tab of one My Places property
--   crm:<customerId>:<propertyId>:<tab>      pro, one tab of one property in the Customer portal
--   feed:places / feed:crm                   the feed banners
CREATE TABLE IF NOT EXISTS public.activity_seen (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (char_length(scope) <= 200),
  seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, scope)
);
ALTER TABLE public.activity_seen ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS activity_seen_own ON public.activity_seen;
CREATE POLICY activity_seen_own ON public.activity_seen
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- CRM activity that has no other home: estimate sends, customers opening estimate/invoice links,
-- statement emails. Written by the server (service role); the pro reads their own.
CREATE TABLE IF NOT EXISTS public.pro_crm_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.pro_crm_customers(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('estimate_sent', 'estimate_viewed', 'invoice_viewed', 'statement_sent')),
  estimate_id UUID REFERENCES public.pro_crm_estimates(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.pro_crm_invoices(id) ON DELETE CASCADE,
  detail TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pro_crm_activity_owner_time ON public.pro_crm_activity (owner_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS pro_crm_activity_customer ON public.pro_crm_activity (customer_id, occurred_at DESC);
ALTER TABLE public.pro_crm_activity ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pro_crm_activity_owner_read ON public.pro_crm_activity;
CREATE POLICY pro_crm_activity_owner_read ON public.pro_crm_activity
  FOR SELECT USING (auth.uid() = owner_id);
