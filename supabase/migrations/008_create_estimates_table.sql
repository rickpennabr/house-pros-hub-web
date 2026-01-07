-- ============================================
-- Migration 008: Create Estimates Table
-- ============================================
-- 
-- This migration creates the estimates table to store customer estimate requests.
-- Estimates can be submitted anonymously (user_id is nullable).
-- ============================================

-- Drop existing estimates table if it exists (for migration purposes)
DROP TABLE IF EXISTS public.estimates CASCADE;

-- Create estimates table
CREATE TABLE public.estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User reference (nullable for anonymous submissions)
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Customer Information
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  
  -- Address Information
  street_address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  apartment TEXT,
  
  -- Project Information
  project_type TEXT NOT NULL CHECK (project_type IN ('new_construction', 'renovation', 'repair', 'remodel', 'other')),
  project_type_other TEXT,
  requires_hoa_approval BOOLEAN NOT NULL DEFAULT false,
  wants_3d BOOLEAN NOT NULL DEFAULT false,
  trades JSONB NOT NULL, -- Array of trade/service IDs
  project_description TEXT NOT NULL,
  project_images JSONB, -- Array of image URLs (max 5)
  budget_range TEXT NOT NULL CHECK (budget_range IN ('under_5k', '5k_10k', '10k_25k', '25k_50k', '50k_100k', 'over_100k', 'not_sure')),
  timeline TEXT NOT NULL CHECK (timeline IN ('asap', 'within_month', '1_3_months', '3_6_months', '6_plus_months', 'flexible')),
  preferred_contact_method TEXT NOT NULL CHECK (preferred_contact_method IN ('phone', 'email', 'text', 'either')),
  additional_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW())
) TABLESPACE pg_default;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_estimates_user_id ON public.estimates USING btree (user_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_estimates_email ON public.estimates USING btree (email) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_estimates_created_at ON public.estimates USING btree (created_at DESC) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_estimates_user_created ON public.estimates USING btree (user_id, created_at DESC) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_estimates_project_type ON public.estimates USING btree (project_type) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_estimates_budget_range ON public.estimates USING btree (budget_range) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_estimates_timeline ON public.estimates USING btree (timeline) TABLESPACE pg_default;

-- GIN index for JSONB trades array (for efficient array queries)
CREATE INDEX IF NOT EXISTS idx_estimates_trades ON public.estimates USING gin (trades) TABLESPACE pg_default;

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_estimates_updated_at
  BEFORE UPDATE ON public.estimates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Policy: Users can view their own estimates
CREATE POLICY "Users can view own estimates"
  ON public.estimates FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Anyone can insert estimates (for anonymous submissions)
CREATE POLICY "Anyone can insert estimates"
  ON public.estimates FOR INSERT
  WITH CHECK (true);

-- Policy: Users can update their own estimates (if needed)
CREATE POLICY "Users can update own estimates"
  ON public.estimates FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Admins can view all estimates (you may want to add admin role check)
-- Note: Adjust this based on your admin role implementation
-- CREATE POLICY "Admins can view all estimates"
--   ON public.estimates FOR SELECT
--   USING (
--     EXISTS (
--       SELECT 1 FROM public.profiles
--       WHERE profiles.id = auth.uid()
--       AND profiles.role = 'admin'
--     )
--   );

-- Add comment to table
COMMENT ON TABLE public.estimates IS 'Stores customer estimate requests. Can be submitted anonymously (user_id nullable).';
COMMENT ON COLUMN public.estimates.user_id IS 'User ID if estimate was submitted by authenticated user, NULL for anonymous submissions';
COMMENT ON COLUMN public.estimates.trades IS 'JSONB array of trade/service category IDs';
COMMENT ON COLUMN public.estimates.project_images IS 'JSONB array of image URLs (max 5 images)';

