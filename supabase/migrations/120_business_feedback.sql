-- Customer feedback on a business, with up to five photos and one reply from the pro.

CREATE TABLE IF NOT EXISTS public.business_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  author_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  body TEXT NOT NULL,
  image_urls TEXT[] NOT NULL DEFAULT '{}',
  pro_response TEXT,
  pro_responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT business_feedback_body_len CHECK (char_length(body) BETWEEN 1 AND 2000),
  CONSTRAINT business_feedback_name_len CHECK (char_length(author_name) BETWEEN 1 AND 120),
  CONSTRAINT business_feedback_images_max CHECK (cardinality(image_urls) <= 5),
  CONSTRAINT business_feedback_response_len CHECK (pro_response IS NULL OR char_length(pro_response) BETWEEN 1 AND 2000)
);

CREATE INDEX IF NOT EXISTS idx_business_feedback_business
  ON public.business_feedback (business_id, created_at DESC);

ALTER TABLE public.business_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read business feedback" ON public.business_feedback;
CREATE POLICY "Public read business feedback"
  ON public.business_feedback FOR SELECT
  TO public
  USING (true);

GRANT SELECT ON public.business_feedback TO anon, authenticated;
GRANT ALL ON public.business_feedback TO service_role;

INSERT INTO storage.buckets (id, name, public)
VALUES ('business-feedback', 'business-feedback', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read business feedback photos" ON storage.objects;
CREATE POLICY "Public read business feedback photos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'business-feedback');
