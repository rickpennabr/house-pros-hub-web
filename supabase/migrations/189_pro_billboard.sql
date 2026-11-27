-- Pro Billboard: the live board that plays on a business page in place of the still hero photo.
-- A pro adds image slides, short videos, and promotions (headline, offer, optional photo, link, dates).

CREATE TABLE IF NOT EXISTS public.pro_billboard_slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('image', 'video', 'promotion')),
  media_url TEXT,
  headline TEXT,
  body TEXT,
  badge TEXT,
  cta_label TEXT,
  cta_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  duration_seconds INTEGER NOT NULL DEFAULT 8 CHECK (duration_seconds BETWEEN 3 AND 30),
  starts_on DATE,
  ends_on DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pro_billboard_slides_content CHECK (
    (kind = 'promotion' AND headline IS NOT NULL AND char_length(btrim(headline)) > 0)
    OR (kind IN ('image', 'video') AND media_url IS NOT NULL AND char_length(btrim(media_url)) > 0)
  ),
  CONSTRAINT pro_billboard_slides_headline_len CHECK (headline IS NULL OR char_length(headline) <= 80),
  CONSTRAINT pro_billboard_slides_body_len CHECK (body IS NULL OR char_length(body) <= 240),
  CONSTRAINT pro_billboard_slides_badge_len CHECK (badge IS NULL OR char_length(badge) <= 24),
  CONSTRAINT pro_billboard_slides_cta_label_len CHECK (cta_label IS NULL OR char_length(cta_label) <= 32),
  CONSTRAINT pro_billboard_slides_dates CHECK (starts_on IS NULL OR ends_on IS NULL OR ends_on >= starts_on)
);

CREATE INDEX IF NOT EXISTS idx_pro_billboard_slides_business
  ON public.pro_billboard_slides (business_id, sort_order, created_at);

COMMENT ON TABLE public.pro_billboard_slides IS
  'Slides for the public Pro Billboard (image, video, or promotion) on a business page.';

ALTER TABLE public.pro_billboard_slides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view live billboard slides"
  ON public.pro_billboard_slides FOR SELECT
  USING (
    is_active
    AND (starts_on IS NULL OR starts_on <= CURRENT_DATE)
    AND (ends_on IS NULL OR ends_on >= CURRENT_DATE)
  );

CREATE POLICY "Owners manage their billboard slides"
  ON public.pro_billboard_slides FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = pro_billboard_slides.business_id
        AND businesses.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id = pro_billboard_slides.business_id
        AND businesses.owner_id = auth.uid()
    )
  );

-- Public media for the board. 25MB covers a short video; images are capped in the API at 5MB.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pro-billboard',
  'pro-billboard',
  true,
  26214400,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "Anyone can view billboard media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'pro-billboard');

CREATE POLICY "Business owners can upload billboard media"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'pro-billboard' AND
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id::text = (storage.foldername(name))[1]
        AND businesses.owner_id = auth.uid()
    )
  );

CREATE POLICY "Business owners can update billboard media"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'pro-billboard' AND
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id::text = (storage.foldername(name))[1]
        AND businesses.owner_id = auth.uid()
    )
  );

CREATE POLICY "Business owners can delete billboard media"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'pro-billboard' AND
    EXISTS (
      SELECT 1 FROM public.businesses
      WHERE businesses.id::text = (storage.foldername(name))[1]
        AND businesses.owner_id = auth.uid()
    )
  );
