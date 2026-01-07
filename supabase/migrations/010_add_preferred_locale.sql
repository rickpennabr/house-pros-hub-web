-- ============================================
-- Migration 010: Add preferred_locale to profiles table
-- ============================================
-- 
-- This migration adds a preferred_locale column to store the user's language preference.
-- This allows the user's language preference to persist across browsers/devices.
-- ============================================

-- Add preferred_locale column to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS preferred_locale TEXT CHECK (preferred_locale IN ('en', 'es'));

-- Add comment to document the column
COMMENT ON COLUMN profiles.preferred_locale IS 'User preferred language locale (en or es). Used to persist language preference across browsers/devices.';

