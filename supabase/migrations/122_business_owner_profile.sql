-- Public owner story on the business About tab.
-- Edited from the business page. Name and photo stay on the account profile.

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS owner_bio TEXT,
  ADD COLUMN IF NOT EXISTS owner_experience TEXT,
  ADD COLUMN IF NOT EXISTS owner_degrees TEXT,
  ADD COLUMN IF NOT EXISTS owner_certifications TEXT,
  ADD COLUMN IF NOT EXISTS owner_years_experience SMALLINT;

ALTER TABLE public.businesses DROP CONSTRAINT IF EXISTS businesses_owner_bio_len;
ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_owner_bio_len
  CHECK (owner_bio IS NULL OR char_length(owner_bio) <= 1500);

ALTER TABLE public.businesses DROP CONSTRAINT IF EXISTS businesses_owner_experience_len;
ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_owner_experience_len
  CHECK (owner_experience IS NULL OR char_length(owner_experience) <= 600);

ALTER TABLE public.businesses DROP CONSTRAINT IF EXISTS businesses_owner_degrees_len;
ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_owner_degrees_len
  CHECK (owner_degrees IS NULL OR char_length(owner_degrees) <= 800);

ALTER TABLE public.businesses DROP CONSTRAINT IF EXISTS businesses_owner_certifications_len;
ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_owner_certifications_len
  CHECK (owner_certifications IS NULL OR char_length(owner_certifications) <= 800);

ALTER TABLE public.businesses DROP CONSTRAINT IF EXISTS businesses_owner_years_experience_range;
ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_owner_years_experience_range
  CHECK (owner_years_experience IS NULL OR owner_years_experience BETWEEN 0 AND 80);

COMMENT ON COLUMN public.businesses.owner_bio IS 'Owner bio shown on the public About tab.';
COMMENT ON COLUMN public.businesses.owner_experience IS 'Short note about the owner''s work in the field.';
COMMENT ON COLUMN public.businesses.owner_degrees IS 'Degrees, one per line.';
COMMENT ON COLUMN public.businesses.owner_certifications IS 'Certifications, one per line.';
COMMENT ON COLUMN public.businesses.owner_years_experience IS 'Years the owner has worked in the field.';
