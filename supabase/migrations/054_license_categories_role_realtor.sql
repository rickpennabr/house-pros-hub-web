-- ============================================
-- Migration 054: license_categories role column + realtor seed
-- ============================================
-- Add role to filter license types by user role (contractor vs realtor).
-- Existing rows default to 'contractor'; seed realtor-only license types.
-- ============================================

-- Add role column; existing rows get 'contractor' by default.
ALTER TABLE license_categories
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'contractor'
  CHECK (role IN ('contractor', 'realtor'));

-- Backfill any rows that might have NULL (shouldn't happen with DEFAULT).
UPDATE license_categories SET role = 'contractor' WHERE role IS NULL;

-- Index for filtering by role in API.
CREATE INDEX IF NOT EXISTS idx_license_categories_role ON license_categories(role);

-- Seed realtor license types (Nevada: Salesperson, Broker).
INSERT INTO license_categories (code, name, description, requires_contractor_license, sort_order, role)
VALUES
  ('REALTOR_SALES', 'Real Estate Salesperson', 'Nevada real estate salesperson license.', false, 0, 'realtor'),
  ('REALTOR_BROKER', 'Real Estate Broker', 'Nevada real estate broker license.', false, 1, 'realtor')
ON CONFLICT (code) DO NOTHING;
