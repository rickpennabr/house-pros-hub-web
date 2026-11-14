-- Optional photo of the customer's house, business, or building.

ALTER TABLE public.customer_places
  ADD COLUMN IF NOT EXISTS photo_path TEXT;

COMMENT ON COLUMN public.customer_places.photo_path IS
  'Property photo in the place-photos bucket. The customer chooses it. Empty when they have not added one.';

INSERT INTO storage.buckets (id, name, public)
VALUES ('place-photos', 'place-photos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read place photos" ON storage.objects;
CREATE POLICY "Public read place photos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'place-photos');
