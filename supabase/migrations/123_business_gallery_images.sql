-- Gallery URLs. Migration 022 added this column locally, but it was never applied
-- on production, so gallery saves failed with PGRST204.
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS images JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.businesses.images IS 'Array of public image URLs for the business gallery (max 30).';

NOTIFY pgrst, 'reload schema';
