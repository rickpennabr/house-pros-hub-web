-- A maintenance house is a maintenance agreement (pro_crm_maintenance_plans) on one of the
-- contact's houses. Contacts can hold several houses, so the agreement names the house,
-- describes the job, and owns its plant list.

ALTER TABLE public.pro_crm_maintenance_plans
  ADD COLUMN IF NOT EXISTS place_id UUID REFERENCES public.customer_places(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scope_of_work TEXT,
  ADD COLUMN IF NOT EXISTS access_notes TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pro_crm_maintenance_plans_scope_len'
  ) THEN
    ALTER TABLE public.pro_crm_maintenance_plans
      ADD CONSTRAINT pro_crm_maintenance_plans_scope_len
        CHECK (scope_of_work IS NULL OR char_length(scope_of_work) <= 4000);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pro_crm_maintenance_plans_access_len'
  ) THEN
    ALTER TABLE public.pro_crm_maintenance_plans
      ADD CONSTRAINT pro_crm_maintenance_plans_access_len
        CHECK (access_notes IS NULL OR char_length(access_notes) <= 1000);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pro_crm_maintenance_plans_place
  ON public.pro_crm_maintenance_plans (place_id) WHERE place_id IS NOT NULL;

COMMENT ON COLUMN public.pro_crm_maintenance_plans.place_id IS
  'House this agreement covers. NULL: the contact''s own address.';
COMMENT ON COLUMN public.pro_crm_maintenance_plans.scope_of_work IS
  'What the crew does on each visit (the job itself).';
COMMENT ON COLUMN public.pro_crm_maintenance_plans.access_notes IS
  'Gate codes, pets, parking, water shut-off: what the crew needs to get in and work.';

-- Plants belong to one house (agreement). Older plants have no plan and stay shared
-- by the contact's houses until someone moves them.
ALTER TABLE public.pro_crm_maintenance_plants
  ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.pro_crm_maintenance_plans(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_pro_crm_maintenance_plants_plan
  ON public.pro_crm_maintenance_plants (plan_id, sort_order) WHERE plan_id IS NOT NULL;

COMMENT ON COLUMN public.pro_crm_maintenance_plants.plan_id IS
  'Maintenance house (agreement) the plant is at. NULL: shared by all of the contact''s houses (older rows).';
