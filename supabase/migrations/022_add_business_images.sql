-- Add images column to businesses (array of image URLs for gallery, max 10)
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]';

COMMENT ON COLUMN businesses.images IS 'Array of image URLs for business gallery (max 10)';

-- RLS Policies for business-images bucket (bucket must be created in Dashboard/CLI)
-- Business owners can upload gallery images for their businesses
CREATE POLICY "Business owners can upload gallery images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'business-images' AND
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id::text = (storage.foldername(name))[1]
      AND businesses.owner_id = auth.uid()
    )
  );

-- Anyone can view business gallery images (public bucket)
CREATE POLICY "Anyone can view business gallery images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'business-images');

-- Business owners can update their business gallery images
CREATE POLICY "Business owners can update gallery images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'business-images' AND
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id::text = (storage.foldername(name))[1]
      AND businesses.owner_id = auth.uid()
    )
  );

-- Business owners can delete their business gallery images
CREATE POLICY "Business owners can delete gallery images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'business-images' AND
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id::text = (storage.foldername(name))[1]
      AND businesses.owner_id = auth.uid()
    )
  );
