-- A project (and its job photos) belongs to one of the contact's properties, like estimates and
-- invoices. NULL: the contact's default property. The job camera picks the property when a
-- contact has more than one, so each address keeps its own photo album.

ALTER TABLE public.pro_crm_projects
  ADD COLUMN IF NOT EXISTS place_id UUID REFERENCES public.customer_places(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pro_crm_projects_place
  ON public.pro_crm_projects (place_id)
  WHERE place_id IS NOT NULL;

COMMENT ON COLUMN public.pro_crm_projects.place_id IS
  'Property this project and its photos are for. NULL: the contact''s default property.';
