-- Compass direction captured with a job photo, degrees clockwise from north.

ALTER TABLE public.pro_jobsite_photos
  ADD COLUMN IF NOT EXISTS heading_deg DOUBLE PRECISION;

ALTER TABLE public.pro_jobsite_photos
  DROP CONSTRAINT IF EXISTS pro_jobsite_photos_heading_range;

ALTER TABLE public.pro_jobsite_photos
  ADD CONSTRAINT pro_jobsite_photos_heading_range
  CHECK (heading_deg IS NULL OR (heading_deg >= 0 AND heading_deg < 360));
