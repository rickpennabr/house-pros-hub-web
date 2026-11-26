-- Brand logos: a brand added in Admin → Products can carry its own logo (shown on product cards and
-- the brand buttons). Belgard, Keystone and Las Vegas Paver keep their built-in logos when this is empty.
ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS logo_url TEXT CHECK (logo_url IS NULL OR char_length(logo_url) <= 1000);

COMMENT ON COLUMN public.brands.logo_url IS 'Brand logo (https or site path). Empty uses the built-in logo for known brands.';
