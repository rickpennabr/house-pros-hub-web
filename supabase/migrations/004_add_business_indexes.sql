-- Migration: Add indexes for business queries performance
-- This migration adds indexes to optimize business listing queries

-- Index for active businesses ordered by creation date (most common query)
CREATE INDEX IF NOT EXISTS idx_businesses_is_active_created 
  ON businesses(is_active, created_at DESC)
  WHERE is_active = true;

-- Note: idx_licenses_business_id already exists in migration 002, so we skip it here
-- CREATE INDEX IF NOT EXISTS idx_licenses_business_id ON licenses(business_id);

-- Index for addresses by user_id (addresses are linked to users, not businesses directly)
-- Note: This index already exists in migration 002 as idx_addresses_user_id
-- We add a composite index for business address lookups via business_address_id
CREATE INDEX IF NOT EXISTS idx_businesses_address_id 
  ON businesses(business_address_id)
  WHERE business_address_id IS NOT NULL;

-- Full-text search index for business names and descriptions
-- This enables fast text search on business_name and company_description
CREATE INDEX IF NOT EXISTS idx_businesses_search 
  ON businesses 
  USING gin(to_tsvector('english', 
    COALESCE(business_name, '') || ' ' || COALESCE(company_description, '')
  ));

-- Index for license types (useful for category filtering)
CREATE INDEX IF NOT EXISTS idx_licenses_license_type 
  ON licenses(license_type);

-- Note: idx_businesses_owner_id already exists in migration 002, so we skip it here
-- CREATE INDEX IF NOT EXISTS idx_businesses_owner_id ON businesses(owner_id);

