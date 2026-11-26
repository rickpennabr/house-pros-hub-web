-- Materials list of an estimate (from ProQuote): what the job needs, not billed lines.
-- When a project is made from the estimate, the list becomes the project's planned materials,
-- so the team can order, track deliveries (planned vs used) and keep a record for analysis.
-- Each row keeps its catalog item (or the pro's own product) for reporting. Safe to run again.

CREATE TABLE IF NOT EXISTS public.pro_crm_estimate_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  estimate_id UUID NOT NULL REFERENCES public.pro_crm_estimates(id) ON DELETE CASCADE,
  catalog_item_id UUID REFERENCES public.trade_catalog_items(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.pro_crm_products(id) ON DELETE SET NULL,
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 200),
  brand TEXT CHECK (brand IS NULL OR char_length(brand) <= 120),
  options TEXT CHECK (options IS NULL OR char_length(options) <= 300),
  area TEXT CHECK (area IS NULL OR char_length(area) <= 120),
  unit TEXT NOT NULL DEFAULT 'each' CHECK (char_length(unit) BETWEEN 1 AND 40),
  qty NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (qty >= 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pro_crm_estimate_materials_estimate
  ON public.pro_crm_estimate_materials (estimate_id, sort_order);

ALTER TABLE public.pro_crm_estimate_materials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners manage estimate materials" ON public.pro_crm_estimate_materials;
CREATE POLICY "Owners manage estimate materials"
  ON public.pro_crm_estimate_materials FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Project materials remember where they came from, for estimated-vs-used reports.
ALTER TABLE public.pro_crm_project_materials
  ADD COLUMN IF NOT EXISTS catalog_item_id UUID REFERENCES public.trade_catalog_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.pro_crm_products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS estimate_material_id UUID REFERENCES public.pro_crm_estimate_materials(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS estimated_qty NUMERIC(12,2) CHECK (estimated_qty IS NULL OR estimated_qty >= 0);
CREATE INDEX IF NOT EXISTS idx_pro_crm_project_materials_catalog
  ON public.pro_crm_project_materials (catalog_item_id) WHERE catalog_item_id IS NOT NULL;
