-- ============================================
-- Migration 055: Allow preferred_locale 'pt' (Portuguese) on profiles
-- ============================================
--
-- Extends the preferred_locale check constraint to include 'pt' so users
-- can persist Portuguese as their language preference.
-- ============================================

-- Drop the existing check constraint (name is the default from ADD COLUMN)
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_preferred_locale_check;

-- Re-add check constraint including pt
ALTER TABLE profiles
ADD CONSTRAINT profiles_preferred_locale_check CHECK (preferred_locale IN ('en', 'es', 'pt'));

-- Update comment to document supported locales
COMMENT ON COLUMN profiles.preferred_locale IS 'User preferred language locale (en, es, or pt). Used to persist language preference across browsers/devices.';
