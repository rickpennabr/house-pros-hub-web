-- ============================================
-- Migration 009: Create Estimate Images Storage Bucket and Policies
-- ============================================
-- 
-- This migration creates the storage bucket for estimate project images
-- and sets up RLS policies for public uploads and reads.
--
-- NOTE: The bucket needs to be created manually in Supabase Dashboard
-- or via Supabase CLI before running this migration.
--
-- To create bucket manually:
-- 1. Go to Supabase Dashboard > Storage
-- 2. Create new bucket named: estimate-images
-- 3. Set bucket to Public
-- 4. File size limit: 2 MB
-- 5. Allowed MIME types: image/jpeg, image/png, image/webp
-- ============================================

-- RLS Policies for estimate-images bucket
-- Allow anyone to upload estimate images (for anonymous submissions)
CREATE POLICY "Anyone can upload estimate images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'estimate-images');

-- Allow anyone to view estimate images (public bucket)
CREATE POLICY "Anyone can view estimate images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'estimate-images');

-- Optional: Allow deletion of estimate images (you may want to restrict this)
-- For now, we'll allow it but you can add user/estimate ownership checks later
CREATE POLICY "Anyone can delete estimate images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'estimate-images');

