-- Hub subscription and ProDrive metered overage.
-- Free includes 0.5 GB. An active Pro plan includes 1 GB.
-- Past that, pay-as-you-go is $0.032 per GB per month.

CREATE TABLE IF NOT EXISTS public.hub_subscriptions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'incomplete')),
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pro_drive_billing (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  overage_enabled BOOLEAN NOT NULL DEFAULT false,
  overage_stripe_subscription_id TEXT,
  overage_stripe_item_id TEXT,
  warned_at_80 TIMESTAMPTZ,
  warned_at_100 TIMESTAMPTZ,
  last_usage_reported_gb INTEGER NOT NULL DEFAULT 0,
  last_usage_reported_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS hub_subscriptions_updated_at ON public.hub_subscriptions;
CREATE TRIGGER hub_subscriptions_updated_at
  BEFORE UPDATE ON public.hub_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.pro_drive_set_updated_at();

DROP TRIGGER IF EXISTS pro_drive_billing_updated_at ON public.pro_drive_billing;
CREATE TRIGGER pro_drive_billing_updated_at
  BEFORE UPDATE ON public.pro_drive_billing
  FOR EACH ROW EXECUTE FUNCTION public.pro_drive_set_updated_at();

ALTER TABLE public.hub_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pro_drive_billing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hub_subscriptions_select_own" ON public.hub_subscriptions;
CREATE POLICY "hub_subscriptions_select_own" ON public.hub_subscriptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "pro_drive_billing_select_own" ON public.pro_drive_billing;
CREATE POLICY "pro_drive_billing_select_own" ON public.pro_drive_billing
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

COMMENT ON TABLE public.hub_subscriptions IS
  'House Pros Hub plan. Free is the default. Pro raises included ProDrive storage to 1 GB.';

COMMENT ON TABLE public.pro_drive_billing IS
  'Opt-in metered ProDrive overage. Writes go through the service role after Stripe confirms.';
