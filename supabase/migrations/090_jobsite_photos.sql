-- Jobsite photos. The bytes live in ProDrive. This table is the timeline.

CREATE TABLE IF NOT EXISTS public.pro_jobsite_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.pro_crm_projects(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  drive_file_id UUID NOT NULL REFERENCES public.pro_drive_files(id) ON DELETE CASCADE,
  caption TEXT,
  taken_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  accuracy_m DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pro_jobsite_photos_caption_len CHECK (caption IS NULL OR char_length(caption) <= 500),
  CONSTRAINT pro_jobsite_photos_lat_range CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
  CONSTRAINT pro_jobsite_photos_lng_range CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180))
);

CREATE INDEX IF NOT EXISTS idx_pro_jobsite_photos_project
  ON public.pro_jobsite_photos (project_id, taken_at DESC);
CREATE INDEX IF NOT EXISTS idx_pro_jobsite_photos_owner
  ON public.pro_jobsite_photos (owner_id);

ALTER TABLE public.pro_jobsite_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pro_jobsite_photos_owner" ON public.pro_jobsite_photos;
CREATE POLICY "pro_jobsite_photos_owner" ON public.pro_jobsite_photos
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

COMMENT ON TABLE public.pro_jobsite_photos IS
  'Contractor jobsite timeline. Photo bytes are ProDrive files, not a separate bucket.';
