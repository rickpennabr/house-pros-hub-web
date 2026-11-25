-- Hardscape ProQuote: each pro's own services and materials with a price per unit.
-- ProQuote reads this list to build estimate lines (area -> sub-area -> services -> materials).
-- A pro with no rows sees the built-in starter list until they save their own.

CREATE TABLE IF NOT EXISTS public.pro_crm_hardscape_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('service', 'material')),
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  unit TEXT NOT NULL DEFAULT 'sq ft' CHECK (char_length(unit) BETWEEN 1 AND 40),
  rate_cents INTEGER NOT NULL DEFAULT 0 CHECK (rate_cents >= 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pro_crm_hardscape_catalog_owner
  ON public.pro_crm_hardscape_catalog (owner_id, kind, sort_order);

ALTER TABLE public.pro_crm_hardscape_catalog ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners manage hardscape catalog" ON public.pro_crm_hardscape_catalog;
CREATE POLICY "Owners manage hardscape catalog"
  ON public.pro_crm_hardscape_catalog
  FOR ALL
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

COMMENT ON TABLE public.pro_crm_hardscape_catalog IS
  'Hardscape ProQuote price list: services and materials per pro, priced per unit (sq ft by default).';
