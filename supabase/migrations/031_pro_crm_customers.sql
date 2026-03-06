-- ProsCRM: contractor-owned customers (contacts)
CREATE TABLE IF NOT EXISTS public.pro_crm_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  street_address TEXT,
  apartment TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pro_crm_customers_owner_id ON public.pro_crm_customers(owner_id);
CREATE INDEX IF NOT EXISTS idx_pro_crm_customers_created_at ON public.pro_crm_customers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pro_crm_customers_last_name ON public.pro_crm_customers(last_name);

CREATE TRIGGER update_pro_crm_customers_updated_at
  BEFORE UPDATE ON public.pro_crm_customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.pro_crm_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contractors can manage own CRM customers"
  ON public.pro_crm_customers
  FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

COMMENT ON TABLE public.pro_crm_customers IS 'ProsCRM: contractor-owned customer contacts.';
