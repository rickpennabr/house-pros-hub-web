-- ============================================
-- Migration 002: Create user_roles, addresses, businesses, and licenses tables
-- ============================================

-- ============================================
-- 1. USER ROLES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('customer', 'contractor')),
  is_active BOOLEAN DEFAULT true,
  activated_at TIMESTAMP WITH TIME ZONE,
  deactivated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(user_id, role)
);

-- Indexes for user_roles
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);
CREATE INDEX IF NOT EXISTS idx_user_roles_active ON user_roles(user_id, is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_roles
CREATE POLICY "Users can view own roles"
  ON user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own roles"
  ON user_roles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own roles"
  ON user_roles FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================
-- 2. ADDRESSES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  address_type TEXT NOT NULL CHECK (address_type IN ('personal', 'business')),
  -- Address fields
  street_address TEXT,
  apartment TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  gate_code TEXT,
  address_note TEXT,
  -- Privacy controls
  is_public BOOLEAN DEFAULT false,
  is_verified BOOLEAN DEFAULT false,
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Indexes for addresses
CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_addresses_type ON addresses(user_id, address_type);
CREATE INDEX IF NOT EXISTS idx_addresses_public ON addresses(user_id, is_public) WHERE is_public = true;

-- Enable RLS
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for addresses
CREATE POLICY "Users can view own addresses"
  ON addresses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Public addresses are viewable"
  ON addresses FOR SELECT
  USING (is_public = true);

CREATE POLICY "Users can insert own addresses"
  ON addresses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own addresses"
  ON addresses FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own addresses"
  ON addresses FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 3. BUSINESSES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  business_name TEXT NOT NULL,
  slug TEXT UNIQUE,
  business_logo TEXT,
  business_background TEXT,
  company_description TEXT,
  -- Business contact (separate from personal)
  email TEXT,
  phone TEXT,
  mobile_phone TEXT,
  -- Business address (references addresses table)
  business_address_id UUID REFERENCES addresses(id),
  -- Links and social media
  links JSONB,
  -- Business hours (JSONB for flexibility)
  operating_hours JSONB,
  timezone TEXT DEFAULT 'America/Los_Angeles',
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Indexes for businesses
CREATE INDEX IF NOT EXISTS idx_businesses_owner_id ON businesses(owner_id);
CREATE INDEX IF NOT EXISTS idx_businesses_slug ON businesses(slug);
CREATE INDEX IF NOT EXISTS idx_businesses_active ON businesses(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_businesses_verified ON businesses(is_verified) WHERE is_verified = true;

-- Enable RLS
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for businesses
CREATE POLICY "Business owners can manage own businesses"
  ON businesses FOR ALL
  USING (auth.uid() = owner_id);

CREATE POLICY "Public can view active businesses"
  ON businesses FOR SELECT
  USING (is_active = true);

-- ============================================
-- 4. LICENSES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  license_number TEXT NOT NULL UNIQUE,
  license_type TEXT NOT NULL,
  license_name TEXT,
  issued_date DATE,
  expiry_date DATE,
  issuing_authority TEXT,
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_verified BOOLEAN DEFAULT false,
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Indexes for licenses
CREATE INDEX IF NOT EXISTS idx_licenses_business_id ON licenses(business_id);
CREATE INDEX IF NOT EXISTS idx_licenses_number ON licenses(license_number);
CREATE INDEX IF NOT EXISTS idx_licenses_active ON licenses(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_licenses_expiry ON licenses(expiry_date) WHERE is_active = true;

-- Enable RLS
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for licenses
CREATE POLICY "Business owners can manage own licenses"
  ON licenses FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM businesses 
      WHERE businesses.id = licenses.business_id 
      AND businesses.owner_id = auth.uid()
    )
  );

CREATE POLICY "Public can view active licenses"
  ON licenses FOR SELECT
  USING (is_active = true);

-- ============================================
-- 5. TRIGGERS FOR UPDATED_AT
-- ============================================

-- Trigger for addresses updated_at
CREATE TRIGGER update_addresses_updated_at
  BEFORE UPDATE ON addresses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for businesses updated_at
CREATE TRIGGER update_businesses_updated_at
  BEFORE UPDATE ON businesses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for licenses updated_at
CREATE TRIGGER update_licenses_updated_at
  BEFORE UPDATE ON licenses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

