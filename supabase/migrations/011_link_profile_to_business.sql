-- ============================================
-- Migration 011: Link profile to business via foreign key
-- ============================================
--
-- Goal:
-- - Replace company_name TEXT field with business_id UUID foreign key
-- - Link profiles to businesses table for referential integrity
-- - Keep company_role (user's role within the business)
--
-- Notes:
-- - business_id is nullable (contractors might not have a business yet)
-- - For existing profiles, we'll try to link to their first active business
-- - company_name will be removed after migration

-- Step 1: Add business_id column (nullable for now)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE SET NULL;

-- Step 2: Create index for the foreign key
CREATE INDEX IF NOT EXISTS idx_profiles_business_id ON profiles(business_id);

-- Step 3: Link existing profiles to their businesses
-- Strategy: Link each profile to their first active business (oldest by created_at)
-- Only update profiles that don't already have a business_id and have a company_name
UPDATE profiles p
SET business_id = (
  SELECT b.id
  FROM businesses b
  WHERE b.owner_id = p.id
    AND b.is_active = true
  ORDER BY b.created_at ASC
  LIMIT 1
)
WHERE p.business_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM businesses b
    WHERE b.owner_id = p.id
      AND b.is_active = true
  );

-- Step 4: Remove company_name column
-- Note: This will fail if any views/functions depend on it, but we've checked the codebase
ALTER TABLE profiles
DROP COLUMN IF EXISTS company_name;

-- Add comment to document the column
COMMENT ON COLUMN profiles.business_id IS 'Foreign key to businesses table. Represents the primary business associated with this contractor profile. Nullable because contractors may not have created a business yet.';

