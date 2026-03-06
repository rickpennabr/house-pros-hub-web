-- Allow license_number to be NULL so multiple businesses can have "no license number"
-- (e.g. Handyman / non-contractor types). Keep uniqueness only for non-null values.
ALTER TABLE licenses DROP CONSTRAINT IF EXISTS licenses_license_number_key;
ALTER TABLE licenses ALTER COLUMN license_number DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_licenses_license_number_unique_not_null
  ON licenses(license_number) WHERE license_number IS NOT NULL;
