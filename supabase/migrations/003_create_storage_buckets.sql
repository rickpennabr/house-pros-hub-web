-- ============================================
-- Migration 003: Create Storage Buckets for Images
-- ============================================
-- 
-- This migration creates the necessary storage buckets for:
-- 1. Profile pictures
-- 2. Business logos
-- 3. Business backgrounds
--
-- NOTE: These buckets need to be created manually in Supabase Dashboard
-- or via the Supabase CLI. This file documents the required setup.
--
-- To create buckets manually:
-- 1. Go to Supabase Dashboard > Storage
-- 2. Create new bucket with the names below
-- 3. Set bucket to Public
-- 4. Configure RLS policies as shown below
-- ============================================

-- Storage buckets to create (via Dashboard or CLI):
-- 1. profile-pictures (Public)
-- 2. business-logos (Public)
-- 3. business-backgrounds (Public)

-- RLS Policies for profile-pictures bucket
-- Users can upload their own profile pictures
CREATE POLICY "Users can upload own profile pictures"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'profile-pictures' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can view all profile pictures (public bucket)
CREATE POLICY "Anyone can view profile pictures"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'profile-pictures');

-- Users can update their own profile pictures
CREATE POLICY "Users can update own profile pictures"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'profile-pictures' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own profile pictures
CREATE POLICY "Users can delete own profile pictures"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'profile-pictures' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- RLS Policies for business-logos bucket
-- Business owners can upload logos for their businesses
CREATE POLICY "Business owners can upload logos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'business-logos' AND
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id::text = (storage.foldername(name))[1]
      AND businesses.owner_id = auth.uid()
    )
  );

-- Anyone can view business logos (public bucket)
CREATE POLICY "Anyone can view business logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'business-logos');

-- Business owners can update their business logos
CREATE POLICY "Business owners can update logos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'business-logos' AND
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id::text = (storage.foldername(name))[1]
      AND businesses.owner_id = auth.uid()
    )
  );

-- Business owners can delete their business logos
CREATE POLICY "Business owners can delete logos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'business-logos' AND
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id::text = (storage.foldername(name))[1]
      AND businesses.owner_id = auth.uid()
    )
  );

-- RLS Policies for business-backgrounds bucket
-- Business owners can upload backgrounds for their businesses
CREATE POLICY "Business owners can upload backgrounds"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'business-backgrounds' AND
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id::text = (storage.foldername(name))[1]
      AND businesses.owner_id = auth.uid()
    )
  );

-- Anyone can view business backgrounds (public bucket)
CREATE POLICY "Anyone can view business backgrounds"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'business-backgrounds');

-- Business owners can update their business backgrounds
CREATE POLICY "Business owners can update backgrounds"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'business-backgrounds' AND
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id::text = (storage.foldername(name))[1]
      AND businesses.owner_id = auth.uid()
    )
  );

-- Business owners can delete their business backgrounds
CREATE POLICY "Business owners can delete backgrounds"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'business-backgrounds' AND
    EXISTS (
      SELECT 1 FROM businesses
      WHERE businesses.id::text = (storage.foldername(name))[1]
      AND businesses.owner_id = auth.uid()
    )
  );

