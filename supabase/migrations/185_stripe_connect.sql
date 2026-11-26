-- Stripe Connect: each business (or the owner's default, business_id null) connects its own Stripe
-- Express account, so customer card payments on invoices go straight to the pro's bank.
CREATE TABLE IF NOT EXISTS public.stripe_connect_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  stripe_account_id TEXT NOT NULL UNIQUE,
  charges_enabled BOOLEAN NOT NULL DEFAULT false,
  payouts_enabled BOOLEAN NOT NULL DEFAULT false,
  details_submitted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_stripe_connect_owner_business
  ON public.stripe_connect_accounts (owner_id, COALESCE(business_id, '00000000-0000-0000-0000-000000000000'::uuid));

ALTER TABLE public.stripe_connect_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners read their Stripe accounts" ON public.stripe_connect_accounts;
CREATE POLICY "Owners read their Stripe accounts"
  ON public.stripe_connect_accounts FOR SELECT
  USING (auth.uid() = owner_id);
-- Writes: service role only (no insert/update/delete policies).
