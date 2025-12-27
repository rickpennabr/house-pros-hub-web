-- ============================================
-- Migration 007: Add company_role_other column to profiles table
-- ============================================
--
-- Goal:
-- - Add a column to store the "other" company role when user selects "Other"
-- - This is similar to referral_other, which stores custom referral sources
--
-- Notes:
-- - This column is nullable since it's only needed when company_role = 'Other'
-- - The column follows the same naming convention as referral_other

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS company_role_other TEXT;

