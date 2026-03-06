-- Add background image position for businesses (object-position, e.g. "50% 50%").
-- Used to persist user's choice of how the background image is aligned in the hero.
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS business_background_position text DEFAULT '50% 50%';

COMMENT ON COLUMN businesses.business_background_position IS 'CSS object-position for the business background image (e.g. 50% 50% for center).';
