-- ProsCRM: contractor-created estimates (quotes) linked to CRM customers
CREATE TABLE IF NOT EXISTS public.pro_crm_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.pro_crm_customers(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  line_items JSONB,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'declined')),
  due_date DATE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pro_crm_estimates_owner_id ON public.pro_crm_estimates(owner_id);
CREATE INDEX IF NOT EXISTS idx_pro_crm_estimates_customer_id ON public.pro_crm_estimates(customer_id);
CREATE INDEX IF NOT EXISTS idx_pro_crm_estimates_created_at ON public.pro_crm_estimates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pro_crm_estimates_status ON public.pro_crm_estimates(status);

CREATE TRIGGER update_pro_crm_estimates_updated_at
  BEFORE UPDATE ON public.pro_crm_estimates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.pro_crm_estimates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contractors can manage own CRM estimates"
  ON public.pro_crm_estimates
  FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

COMMENT ON TABLE public.pro_crm_estimates IS 'ProsCRM: contractor-created quotes for CRM customers.';
