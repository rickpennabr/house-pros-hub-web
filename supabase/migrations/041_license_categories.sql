-- License categories for contractor/license type (e.g. Handyman vs Licensed Contractor).
-- Admin can add new categories; forms use these to show the correct license type options.
CREATE TABLE IF NOT EXISTS license_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  requires_contractor_license BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_license_categories_code ON license_categories(code);
CREATE INDEX IF NOT EXISTS idx_license_categories_sort ON license_categories(sort_order);

ALTER TABLE license_categories ENABLE ROW LEVEL SECURITY;

-- Only service role / backend can manage; no RLS policies for app auth (admin uses API with auth check).
-- Allow public read so signup/business forms can list categories.
CREATE POLICY "Public can view license categories"
  ON license_categories FOR SELECT
  USING (true);

-- Seed two categories: Handyman (no contractor license) and Licensed Contractor (contractor license required).
INSERT INTO license_categories (code, name, description, requires_contractor_license, sort_order)
VALUES
  ('HANDYMAN', 'Handyman', 'Handyman (no contractor license required). Nevada Business License only.', false, 0),
  ('LICENSED_CONTRACTOR', 'Licensed Contractor', 'Licensed contractor. Requires state contractor license classification and number.', true, 1)
ON CONFLICT (code) DO NOTHING;

-- Trigger for updated_at
CREATE TRIGGER update_license_categories_updated_at
  BEFORE UPDATE ON license_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
