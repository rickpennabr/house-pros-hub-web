-- ProsCRM: normalized addresses and contact methods (QuickBooks-style)
-- New tables; existing pro_crm_customers columns kept for backward compatibility until app is migrated.

-- Addresses: one row per address per customer (billing, shipping, other)
CREATE TABLE IF NOT EXISTS public.pro_crm_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.pro_crm_customers(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('billing', 'shipping', 'primary', 'other')),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  street_1 TEXT,
  street_2 TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  country TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pro_crm_addresses_customer_id ON public.pro_crm_addresses(customer_id);
CREATE INDEX IF NOT EXISTS idx_pro_crm_addresses_customer_type ON public.pro_crm_addresses(customer_id, type);

ALTER TABLE public.pro_crm_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contractors can manage addresses for own customers"
  ON public.pro_crm_addresses
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.pro_crm_customers c
      WHERE c.id = pro_crm_addresses.customer_id AND c.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pro_crm_customers c
      WHERE c.id = pro_crm_addresses.customer_id AND c.owner_id = auth.uid()
    )
  );

COMMENT ON TABLE public.pro_crm_addresses IS 'ProsCRM: normalized addresses per customer (billing, shipping, etc.).';

-- Contact methods: one row per phone/email/fax/website per customer
CREATE TABLE IF NOT EXISTS public.pro_crm_contact_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.pro_crm_customers(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('phone', 'mobile', 'fax', 'email', 'website', 'other')),
  value TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pro_crm_contact_methods_customer_id ON public.pro_crm_contact_methods(customer_id);
CREATE INDEX IF NOT EXISTS idx_pro_crm_contact_methods_customer_kind ON public.pro_crm_contact_methods(customer_id, kind);

ALTER TABLE public.pro_crm_contact_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contractors can manage contact methods for own customers"
  ON public.pro_crm_contact_methods
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.pro_crm_customers c
      WHERE c.id = pro_crm_contact_methods.customer_id AND c.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pro_crm_customers c
      WHERE c.id = pro_crm_contact_methods.customer_id AND c.owner_id = auth.uid()
    )
  );

COMMENT ON TABLE public.pro_crm_contact_methods IS 'ProsCRM: normalized contact methods (phone, email, fax, website) per customer.';

-- Backfill addresses from existing customer columns
INSERT INTO public.pro_crm_addresses (customer_id, type, is_primary, street_1, street_2, city, state, zip_code, country)
SELECT
  c.id,
  'billing',
  true,
  COALESCE(NULLIF(TRIM(c.billing_address_street_1), ''), NULLIF(TRIM(c.street_address), '')),
  COALESCE(NULLIF(TRIM(c.billing_address_street_2), ''), NULLIF(TRIM(c.apartment), '')),
  COALESCE(NULLIF(TRIM(c.billing_address_city), ''), NULLIF(TRIM(c.city), '')),
  COALESCE(NULLIF(TRIM(c.billing_address_state), ''), NULLIF(TRIM(c.state), '')),
  COALESCE(NULLIF(TRIM(c.billing_address_zip_code), ''), NULLIF(TRIM(c.zip_code), '')),
  NULLIF(TRIM(c.billing_address_country), '')
FROM public.pro_crm_customers c
WHERE (
  c.billing_address_street_1 IS NOT NULL AND c.billing_address_street_1 <> ''
  OR c.billing_address_city IS NOT NULL AND c.billing_address_city <> ''
  OR c.street_address IS NOT NULL AND c.street_address <> ''
  OR c.city IS NOT NULL AND c.city <> ''
  OR c.state IS NOT NULL AND c.state <> ''
  OR c.zip_code IS NOT NULL AND c.zip_code <> ''
);

-- Backfill shipping addresses where different from billing
INSERT INTO public.pro_crm_addresses (customer_id, type, is_primary, street_1, street_2, city, state, zip_code, country)
SELECT
  c.id,
  'shipping',
  false,
  NULLIF(TRIM(c.shipping_address_street_1), ''),
  NULLIF(TRIM(c.shipping_address_street_2), ''),
  NULLIF(TRIM(c.shipping_address_city), ''),
  NULLIF(TRIM(c.shipping_address_state), ''),
  NULLIF(TRIM(c.shipping_address_zip_code), ''),
  NULLIF(TRIM(c.shipping_address_country), '')
FROM public.pro_crm_customers c
WHERE c.shipping_same_as_billing = false
  AND (
    c.shipping_address_street_1 IS NOT NULL AND c.shipping_address_street_1 <> ''
    OR c.shipping_address_city IS NOT NULL AND c.shipping_address_city <> ''
    OR c.shipping_address_state IS NOT NULL AND c.shipping_address_state <> ''
    OR c.shipping_address_zip_code IS NOT NULL AND c.shipping_address_zip_code <> ''
  );

-- Backfill contact methods from email, phone, mobile_number, fax, website
INSERT INTO public.pro_crm_contact_methods (customer_id, kind, value, is_primary)
SELECT id, 'email', TRIM(email), true
FROM public.pro_crm_customers
WHERE email IS NOT NULL AND TRIM(email) <> '';

INSERT INTO public.pro_crm_contact_methods (customer_id, kind, value, is_primary)
SELECT id, 'phone', TRIM(phone), true
FROM public.pro_crm_customers
WHERE phone IS NOT NULL AND TRIM(phone) <> '';

INSERT INTO public.pro_crm_contact_methods (customer_id, kind, value, is_primary)
SELECT id, 'mobile', TRIM(mobile_number), true
FROM public.pro_crm_customers
WHERE mobile_number IS NOT NULL AND TRIM(mobile_number) <> '';

INSERT INTO public.pro_crm_contact_methods (customer_id, kind, value, is_primary)
SELECT id, 'fax', TRIM(fax), false
FROM public.pro_crm_customers
WHERE fax IS NOT NULL AND TRIM(fax) <> '';

INSERT INTO public.pro_crm_contact_methods (customer_id, kind, value, is_primary)
SELECT id, 'website', TRIM(website), false
FROM public.pro_crm_customers
WHERE website IS NOT NULL AND TRIM(website) <> '';
