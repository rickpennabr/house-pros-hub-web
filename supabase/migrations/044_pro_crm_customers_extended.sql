-- ProsCRM: extend customer table with name/contact, addresses, payments, notes/attachments (English/Spanish only for invoice language)

-- Name and contact (beyond existing first_name, last_name, email, phone)
ALTER TABLE public.pro_crm_customers
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS middle_name TEXT,
  ADD COLUMN IF NOT EXISTS suffix TEXT,
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS cc TEXT,
  ADD COLUMN IF NOT EXISTS bcc TEXT,
  ADD COLUMN IF NOT EXISTS mobile_number TEXT,
  ADD COLUMN IF NOT EXISTS fax TEXT,
  ADD COLUMN IF NOT EXISTS other TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS name_on_checks TEXT,
  ADD COLUMN IF NOT EXISTS is_sub_customer BOOLEAN NOT NULL DEFAULT false;

-- Billing address (explicit columns; existing street_address/apartment/city/state/zip_code kept for backward compatibility)
ALTER TABLE public.pro_crm_customers
  ADD COLUMN IF NOT EXISTS billing_address_street_1 TEXT,
  ADD COLUMN IF NOT EXISTS billing_address_street_2 TEXT,
  ADD COLUMN IF NOT EXISTS billing_address_city TEXT,
  ADD COLUMN IF NOT EXISTS billing_address_state TEXT,
  ADD COLUMN IF NOT EXISTS billing_address_zip_code TEXT,
  ADD COLUMN IF NOT EXISTS billing_address_country TEXT;

-- Shipping address
ALTER TABLE public.pro_crm_customers
  ADD COLUMN IF NOT EXISTS shipping_same_as_billing BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS shipping_address_street_1 TEXT,
  ADD COLUMN IF NOT EXISTS shipping_address_street_2 TEXT,
  ADD COLUMN IF NOT EXISTS shipping_address_city TEXT,
  ADD COLUMN IF NOT EXISTS shipping_address_state TEXT,
  ADD COLUMN IF NOT EXISTS shipping_address_zip_code TEXT,
  ADD COLUMN IF NOT EXISTS shipping_address_country TEXT;

-- Notes (existing `note` kept; `notes` for extended notes section if needed)
ALTER TABLE public.pro_crm_customers
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Custom fields (key-value store for "Add custom field")
ALTER TABLE public.pro_crm_customers
  ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}';

-- Payments and additional info
ALTER TABLE public.pro_crm_customers
  ADD COLUMN IF NOT EXISTS primary_payment_method TEXT,
  ADD COLUMN IF NOT EXISTS payment_terms TEXT,
  ADD COLUMN IF NOT EXISTS sales_form_delivery_options TEXT,
  ADD COLUMN IF NOT EXISTS invoice_language TEXT NOT NULL DEFAULT 'en' CHECK (invoice_language IN ('en', 'es')),
  ADD COLUMN IF NOT EXISTS tax_exemption_details TEXT,
  ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(12, 2) DEFAULT 0;

-- Backfill display_name from first_name + last_name where null (optional, for existing rows)
UPDATE public.pro_crm_customers
SET display_name = TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, ''))
WHERE display_name IS NULL AND (first_name IS NOT NULL OR last_name IS NOT NULL);

-- Attachments: separate table (max file size 20 MB per file)
CREATE TABLE IF NOT EXISTS public.pro_crm_customer_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.pro_crm_customers(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pro_crm_customer_attachments_customer_id ON public.pro_crm_customer_attachments(customer_id);
CREATE INDEX IF NOT EXISTS idx_pro_crm_customer_attachments_owner_id ON public.pro_crm_customer_attachments(owner_id);

ALTER TABLE public.pro_crm_customer_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contractors can manage own customer attachments"
  ON public.pro_crm_customer_attachments
  FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

COMMENT ON TABLE public.pro_crm_customer_attachments IS 'ProsCRM: file attachments for customers (max 20 MB per file).';
COMMENT ON COLUMN public.pro_crm_customers.invoice_language IS 'Language for invoices: en (English) or es (Spanish) only.';
