-- Opt-in CRM products on the public pro details page.
-- Realtor properties tab for listings. Installer/handyman keep trades on their profile pages.

ALTER TABLE public.pro_crm_products
  ADD COLUMN IF NOT EXISTS show_on_profile BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_pro_crm_products_show_on_profile
  ON public.pro_crm_products (owner_id)
  WHERE show_on_profile;

COMMENT ON COLUMN public.pro_crm_products.show_on_profile IS
  'When true, this CRM product appears on the pro details Products tab.';

CREATE TABLE IF NOT EXISTS public.realtor_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  street_address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  price_cents INTEGER,
  beds NUMERIC(4, 1),
  baths NUMERIC(4, 1),
  sqft INTEGER,
  status TEXT NOT NULL DEFAULT 'for_sale'
    CHECK (status IN ('for_sale', 'pending', 'sold', 'off_market')),
  description TEXT,
  image_url TEXT,
  show_on_profile BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT realtor_properties_title_length CHECK (char_length(btrim(title)) BETWEEN 1 AND 160)
);

CREATE INDEX IF NOT EXISTS idx_realtor_properties_owner
  ON public.realtor_properties (owner_id, display_order, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_realtor_properties_business
  ON public.realtor_properties (business_id)
  WHERE business_id IS NOT NULL;

ALTER TABLE public.realtor_properties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS realtor_properties_public_read ON public.realtor_properties;
CREATE POLICY realtor_properties_public_read
  ON public.realtor_properties
  FOR SELECT
  TO anon, authenticated
  USING (show_on_profile = true OR owner_id = auth.uid());

DROP POLICY IF EXISTS realtor_properties_owner_write ON public.realtor_properties;
CREATE POLICY realtor_properties_owner_write
  ON public.realtor_properties
  FOR ALL
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

COMMENT ON TABLE public.realtor_properties IS
  'Listings shown on a realtor business details Properties tab.';
