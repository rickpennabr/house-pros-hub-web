-- Project materials and deliveries, for any trade.
-- A material has a planned quantity in a unit (pallet, ton, bag, LF, pcs…); each delivery records
-- what was sent and when. "Still to send" = planned − delivered.
-- Trips also remember who logged them (the owner or a crew member).

CREATE TABLE IF NOT EXISTS public.pro_crm_project_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.pro_crm_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 200),
  unit TEXT NOT NULL DEFAULT 'each' CHECK (char_length(unit) BETWEEN 1 AND 40),
  planned_qty NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (planned_qty >= 0),
  note TEXT CHECK (note IS NULL OR char_length(note) <= 500),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pro_crm_project_materials_project
  ON public.pro_crm_project_materials (project_id, sort_order);

CREATE TABLE IF NOT EXISTS public.pro_crm_project_material_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.pro_crm_projects(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES public.pro_crm_project_materials(id) ON DELETE CASCADE,
  delivered_on DATE NOT NULL DEFAULT CURRENT_DATE,
  quantity NUMERIC(12,2) NOT NULL CHECK (quantity > 0),
  source TEXT CHECK (source IS NULL OR char_length(source) <= 120),
  note TEXT CHECK (note IS NULL OR char_length(note) <= 500),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pro_crm_material_deliveries_material
  ON public.pro_crm_project_material_deliveries (material_id, delivered_on);
CREATE INDEX IF NOT EXISTS idx_pro_crm_material_deliveries_project
  ON public.pro_crm_project_material_deliveries (project_id);

ALTER TABLE public.pro_crm_project_materials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners manage project materials" ON public.pro_crm_project_materials;
CREATE POLICY "Owners manage project materials"
  ON public.pro_crm_project_materials
  FOR ALL
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

ALTER TABLE public.pro_crm_project_material_deliveries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners manage material deliveries" ON public.pro_crm_project_material_deliveries;
CREATE POLICY "Owners manage material deliveries"
  ON public.pro_crm_project_material_deliveries
  FOR ALL
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Who logged a trip: the owner or a crew member (crew act under the owner's id).
ALTER TABLE public.pro_crm_mileage_trips
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by_name TEXT;

COMMENT ON TABLE public.pro_crm_project_materials IS
  'Materials planned for a project (any trade). Deliveries are in pro_crm_project_material_deliveries.';
