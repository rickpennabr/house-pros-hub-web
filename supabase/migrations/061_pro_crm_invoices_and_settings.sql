-- ProsCRM: invoice settings per contractor (default business, theme, invoice number sequence)
CREATE TABLE IF NOT EXISTS public.pro_invoice_settings (
  owner_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  default_business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
  theme_color_hex TEXT NOT NULL DEFAULT '#000000',
  invoice_prefix TEXT NOT NULL DEFAULT 'INV',
  next_number INTEGER NOT NULL DEFAULT 1,
  company_tagline TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_pro_invoice_settings_updated_at
  BEFORE UPDATE ON public.pro_invoice_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.pro_invoice_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contractors can manage own invoice settings"
  ON public.pro_invoice_settings
  FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

COMMENT ON TABLE public.pro_invoice_settings IS 'ProsCRM: per-contractor invoice branding and number sequence.';

-- ProsCRM: invoices linked to customers and optional estimate
CREATE TABLE IF NOT EXISTS public.pro_crm_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.pro_crm_customers(id) ON DELETE CASCADE,
  estimate_id UUID REFERENCES public.pro_crm_estimates(id) ON DELETE SET NULL,
  business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  payment_applied_cents INTEGER NOT NULL DEFAULT 0,
  line_items JSONB,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue')),
  invoice_date DATE NOT NULL DEFAULT (CURRENT_DATE),
  due_date DATE,
  payment_terms TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pro_crm_invoices_owner_id ON public.pro_crm_invoices(owner_id);
CREATE INDEX IF NOT EXISTS idx_pro_crm_invoices_customer_id ON public.pro_crm_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_pro_crm_invoices_estimate_id ON public.pro_crm_invoices(estimate_id);
CREATE INDEX IF NOT EXISTS idx_pro_crm_invoices_status ON public.pro_crm_invoices(status);
CREATE INDEX IF NOT EXISTS idx_pro_crm_invoices_created_at ON public.pro_crm_invoices(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pro_crm_invoices_owner_number ON public.pro_crm_invoices(owner_id, invoice_number);

CREATE TRIGGER update_pro_crm_invoices_updated_at
  BEFORE UPDATE ON public.pro_crm_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.pro_crm_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contractors can manage own CRM invoices"
  ON public.pro_crm_invoices
  FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

COMMENT ON TABLE public.pro_crm_invoices IS 'ProsCRM: invoices for CRM customers; can be created from estimates.';
