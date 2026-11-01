-- ProsCRM: reusable products and services for invoices/estimates
CREATE TABLE IF NOT EXISTS public.pro_crm_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  item_type TEXT NOT NULL DEFAULT 'service' CHECK (item_type IN ('service', 'product')),
  sku TEXT,
  category TEXT,
  image_url TEXT,
  description TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0,
  unit TEXT DEFAULT 'each',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pro_crm_items_owner_id ON public.pro_crm_items(owner_id);
CREATE INDEX IF NOT EXISTS idx_pro_crm_items_display_order ON public.pro_crm_items(owner_id, display_order);

CREATE TRIGGER update_pro_crm_items_updated_at
  BEFORE UPDATE ON public.pro_crm_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.pro_crm_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contractors can manage own CRM items"
  ON public.pro_crm_items
  FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

COMMENT ON TABLE public.pro_crm_items IS 'ProsCRM: reusable products and services for invoice/estimate line items.';
