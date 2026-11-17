-- Plant inventory per maintenance property (CRM customer), with photos from ProDrive.
-- Plants belong to the property, not the visit, so the list carries over to the next visit.

CREATE TABLE IF NOT EXISTS public.pro_crm_maintenance_plants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.pro_crm_customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1 AND quantity <= 9999),
  area TEXT,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pro_crm_maintenance_plants_name_len CHECK (char_length(btrim(name)) BETWEEN 1 AND 120),
  CONSTRAINT pro_crm_maintenance_plants_area_len CHECK (area IS NULL OR char_length(area) <= 80),
  CONSTRAINT pro_crm_maintenance_plants_notes_len CHECK (notes IS NULL OR char_length(notes) <= 1000)
);

CREATE INDEX IF NOT EXISTS idx_pro_crm_maintenance_plants_customer
  ON public.pro_crm_maintenance_plants (owner_id, customer_id, sort_order);

DROP TRIGGER IF EXISTS update_pro_crm_maintenance_plants_updated_at ON public.pro_crm_maintenance_plants;
CREATE TRIGGER update_pro_crm_maintenance_plants_updated_at
  BEFORE UPDATE ON public.pro_crm_maintenance_plants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.pro_crm_maintenance_plants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage maintenance plants" ON public.pro_crm_maintenance_plants;
CREATE POLICY "Owners manage maintenance plants"
  ON public.pro_crm_maintenance_plants
  FOR ALL
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pro_crm_maintenance_plants TO authenticated;
GRANT ALL ON public.pro_crm_maintenance_plants TO service_role;

COMMENT ON TABLE public.pro_crm_maintenance_plants IS
  'Plants at a maintenance property (CRM customer). Shared by every visit to that property.';

CREATE TABLE IF NOT EXISTS public.pro_crm_maintenance_plant_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id UUID NOT NULL REFERENCES public.pro_crm_maintenance_plants(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  drive_file_id UUID NOT NULL REFERENCES public.pro_drive_files(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS pro_crm_maintenance_plant_images_file_uidx
  ON public.pro_crm_maintenance_plant_images (plant_id, drive_file_id);

CREATE INDEX IF NOT EXISTS idx_pro_crm_maintenance_plant_images_plant
  ON public.pro_crm_maintenance_plant_images (plant_id, sort_order);

ALTER TABLE public.pro_crm_maintenance_plant_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage maintenance plant images" ON public.pro_crm_maintenance_plant_images;
CREATE POLICY "Owners manage maintenance plant images"
  ON public.pro_crm_maintenance_plant_images
  FOR ALL
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pro_crm_maintenance_plant_images TO authenticated;
GRANT ALL ON public.pro_crm_maintenance_plant_images TO service_role;
