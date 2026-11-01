-- Quick Repair stores a GPS fix and the ProDrive file ids behind the photos.
-- Existing source values stay valid. quick_repair is the header ProCam path.

ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS location_accuracy_m DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS project_drive_file_ids UUID[] NOT NULL DEFAULT '{}';

ALTER TABLE public.estimates DROP CONSTRAINT IF EXISTS estimates_source_check;
ALTER TABLE public.estimates
  ADD CONSTRAINT estimates_source_check
  CHECK (source IN ('web', 'agent', 'quick_repair'));

ALTER TABLE public.estimates DROP CONSTRAINT IF EXISTS estimates_lat_range;
ALTER TABLE public.estimates
  ADD CONSTRAINT estimates_lat_range
  CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90));

ALTER TABLE public.estimates DROP CONSTRAINT IF EXISTS estimates_lng_range;
ALTER TABLE public.estimates
  ADD CONSTRAINT estimates_lng_range
  CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));

ALTER TABLE public.estimates DROP CONSTRAINT IF EXISTS estimates_drive_files_max;
ALTER TABLE public.estimates
  ADD CONSTRAINT estimates_drive_files_max
  CHECK (cardinality(project_drive_file_ids) <= 5);
