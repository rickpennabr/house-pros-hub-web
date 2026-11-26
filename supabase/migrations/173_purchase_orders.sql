-- Purchase orders: a pro orders materials from a supplier for a project.
-- Draft -> sent -> confirmed (supplier, from the share link) -> partial/received -> closed, or cancelled.
-- Receiving a line logs a project material delivery and creates an expense linked to the PO.

CREATE TABLE IF NOT EXISTS public.pro_crm_purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  po_number TEXT NOT NULL CHECK (char_length(po_number) BETWEEN 1 AND 40),
  supplier_id UUID REFERENCES public.pro_crm_customers(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.pro_crm_projects(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'confirmed', 'partial', 'received', 'closed', 'cancelled')),
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  needed_by DATE,
  delivery_address TEXT CHECK (delivery_address IS NULL OR char_length(delivery_address) <= 500),
  notes TEXT CHECK (notes IS NULL OR char_length(notes) <= 2000),
  tax_cents BIGINT NOT NULL DEFAULT 0 CHECK (tax_cents >= 0),
  shipping_cents BIGINT NOT NULL DEFAULT 0 CHECK (shipping_cents >= 0),
  subtotal_cents BIGINT NOT NULL DEFAULT 0,
  total_cents BIGINT NOT NULL DEFAULT 0,
  share_token TEXT UNIQUE,
  sent_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, po_number)
);
CREATE INDEX IF NOT EXISTS idx_pro_crm_purchase_orders_owner ON public.pro_crm_purchase_orders (owner_id, order_date DESC);
CREATE INDEX IF NOT EXISTS idx_pro_crm_purchase_orders_project ON public.pro_crm_purchase_orders (project_id);
CREATE INDEX IF NOT EXISTS idx_pro_crm_purchase_orders_supplier ON public.pro_crm_purchase_orders (supplier_id);

CREATE TABLE IF NOT EXISTS public.pro_crm_purchase_order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  purchase_order_id UUID NOT NULL REFERENCES public.pro_crm_purchase_orders(id) ON DELETE CASCADE,
  material_id UUID REFERENCES public.pro_crm_project_materials(id) ON DELETE SET NULL,
  description TEXT NOT NULL CHECK (char_length(btrim(description)) BETWEEN 1 AND 300),
  quantity NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL DEFAULT 'Each' CHECK (char_length(unit) BETWEEN 1 AND 40),
  unit_price_cents BIGINT NOT NULL DEFAULT 0 CHECK (unit_price_cents >= 0),
  received_qty NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (received_qty >= 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pro_crm_purchase_order_lines_po ON public.pro_crm_purchase_order_lines (purchase_order_id, sort_order);

ALTER TABLE public.pro_crm_purchase_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners manage purchase orders" ON public.pro_crm_purchase_orders;
CREATE POLICY "Owners manage purchase orders" ON public.pro_crm_purchase_orders
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

ALTER TABLE public.pro_crm_purchase_order_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners manage purchase order lines" ON public.pro_crm_purchase_order_lines;
CREATE POLICY "Owners manage purchase order lines" ON public.pro_crm_purchase_order_lines
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Expenses created by receiving a PO point back to it.
ALTER TABLE public.pro_crm_expenses
  ADD COLUMN IF NOT EXISTS purchase_order_id UUID REFERENCES public.pro_crm_purchase_orders(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_pro_crm_expenses_purchase_order ON public.pro_crm_expenses (purchase_order_id);

-- PO numbering per pro, next to the invoice numbering.
ALTER TABLE public.pro_invoice_settings
  ADD COLUMN IF NOT EXISTS po_prefix TEXT NOT NULL DEFAULT 'PO',
  ADD COLUMN IF NOT EXISTS next_po_number INTEGER NOT NULL DEFAULT 1;

COMMENT ON TABLE public.pro_crm_purchase_orders IS 'Purchase orders a pro sends to a supplier, usually for a project.';
COMMENT ON TABLE public.pro_crm_purchase_order_lines IS 'Items on a purchase order; received_qty grows as deliveries arrive.';
