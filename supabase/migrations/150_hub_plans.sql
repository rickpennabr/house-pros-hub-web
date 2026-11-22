-- Company subscription plans, managed by the admin at /admin/subscriptions.
-- Saving a plan there creates the matching Stripe product and prices.
-- Yearly price defaults to 10 months (2 months free).

CREATE TABLE IF NOT EXISTS public.hub_plans (
  slug TEXT PRIMARY KEY CHECK (slug ~ '^[a-z0-9-]{2,30}$'),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  tagline TEXT NOT NULL DEFAULT '' CHECK (char_length(tagline) <= 160),
  monthly_price_cents INTEGER NOT NULL DEFAULT 0 CHECK (monthly_price_cents >= 0),
  yearly_price_cents INTEGER NOT NULL DEFAULT 0 CHECK (yearly_price_cents >= 0),
  -- Users included. NULL = no limit.
  included_users INTEGER CHECK (included_users IS NULL OR included_users >= 1),
  -- Price per user over included_users (0 = extra users not sold).
  extra_user_price_cents INTEGER NOT NULL DEFAULT 0 CHECK (extra_user_price_cents >= 0),
  storage_gb NUMERIC(8, 2) NOT NULL DEFAULT 0.5 CHECK (storage_gb >= 0),
  -- Free ProTrades included on this plan. NULL = all trades.
  protrades_limit INTEGER CHECK (protrades_limit IS NULL OR protrades_limit >= 0),
  trial_days INTEGER NOT NULL DEFAULT 0 CHECK (trial_days BETWEEN 0 AND 90),
  features TEXT[] NOT NULL DEFAULT '{}',
  highlight BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  stripe_product_id TEXT,
  stripe_monthly_price_id TEXT,
  stripe_yearly_price_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS hub_plans_updated_at ON public.hub_plans;
CREATE TRIGGER hub_plans_updated_at
  BEFORE UPDATE ON public.hub_plans
  FOR EACH ROW EXECUTE FUNCTION public.pro_drive_set_updated_at();

ALTER TABLE public.hub_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hub_plans_public_read" ON public.hub_plans;
CREATE POLICY "hub_plans_public_read" ON public.hub_plans
  FOR SELECT TO anon, authenticated
  USING (is_active);

INSERT INTO public.hub_plans
  (slug, name, tagline, monthly_price_cents, yearly_price_cents, included_users, extra_user_price_cents, storage_gb, protrades_limit, features, highlight, sort_order)
VALUES
  ('free', 'Free', 'Try the hub. The CRM and every ProTrade, free.', 0, 0, 1, 0, 0.5, 1,
    ARRAY['General CRM: contacts, estimates, invoices', 'All ProTrades, free', 'ProBot assistant', 'Customer portal'], false, 0),
  ('pro', 'Pro', 'For the solo pro who wants it all.', 2900, 29000, 1, 0, 25, NULL,
    ARRAY['Everything in Free', 'Your logo and branding', 'Online payments', '25 GB ProCam storage'], false, 1),
  ('team', 'Team', 'For a company with a crew.', 7900, 79000, 5, 0, 100, NULL,
    ARRAY['Everything in Pro', 'Up to 5 users', 'Crew logins and roles', 'Scheduling and dispatch', '100 GB storage'], true, 2),
  ('business', 'Business', 'For bigger companies.', 14900, 149000, 10, 1200, 250, NULL,
    ARRAY['Everything in Team', 'Up to 10 users, then $12/user', 'Reports, mileage and crew time', '250 GB storage', 'Onboarding help'], false, 3)
ON CONFLICT (slug) DO NOTHING;

-- Subscriptions now point at any plan slug.
ALTER TABLE public.hub_subscriptions DROP CONSTRAINT IF EXISTS hub_subscriptions_plan_check;
ALTER TABLE public.hub_subscriptions
  ADD COLUMN IF NOT EXISTS billing_interval TEXT CHECK (billing_interval IS NULL OR billing_interval IN ('month', 'year')),
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  -- Given by the admin without Stripe (partner, test, promo). Stripe webhooks leave it alone.
  ADD COLUMN IF NOT EXISTS comped BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS comped_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admin_note TEXT CHECK (admin_note IS NULL OR char_length(admin_note) <= 1000);

COMMENT ON TABLE public.hub_plans IS 'Company subscription plans. Edited at /admin/subscriptions; synced to Stripe.';
