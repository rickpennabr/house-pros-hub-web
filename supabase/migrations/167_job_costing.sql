-- Job costing: link money to projects and maintenance plans, labor rates and time entries,
-- equipment daily rates, and overhead %. Feeds the per-job and whole-business financial reports.

-- 1. Revenue and costs linked to a project or a maintenance plan
ALTER TABLE public.pro_crm_invoices
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.pro_crm_projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS maintenance_plan_id UUID REFERENCES public.pro_crm_maintenance_plans(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_pro_crm_invoices_project ON public.pro_crm_invoices (project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pro_crm_invoices_plan ON public.pro_crm_invoices (maintenance_plan_id) WHERE maintenance_plan_id IS NOT NULL;

ALTER TABLE public.pro_crm_expenses
  ADD COLUMN IF NOT EXISTS maintenance_plan_id UUID REFERENCES public.pro_crm_maintenance_plans(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_pro_crm_expenses_plan ON public.pro_crm_expenses (maintenance_plan_id) WHERE maintenance_plan_id IS NOT NULL;

ALTER TABLE public.pro_crm_mileage_trips
  ADD COLUMN IF NOT EXISTS maintenance_plan_id UUID REFERENCES public.pro_crm_maintenance_plans(id) ON DELETE SET NULL;

-- Invoices made from a project's estimate belong to that project; from a plan's estimate, to that plan.
UPDATE public.pro_crm_invoices inv
SET project_id = p.id
FROM public.pro_crm_projects p
WHERE inv.project_id IS NULL
  AND inv.estimate_id IS NOT NULL
  AND p.estimate_id = inv.estimate_id
  AND p.owner_id = inv.owner_id;

UPDATE public.pro_crm_invoices inv
SET maintenance_plan_id = mp.id
FROM public.pro_crm_maintenance_plans mp
WHERE inv.maintenance_plan_id IS NULL
  AND inv.project_id IS NULL
  AND inv.estimate_id IS NOT NULL
  AND mp.source_estimate_id = inv.estimate_id
  AND mp.owner_id = inv.owner_id;

-- 2. Labor cost per hour (what the pro pays, not what they bill)
ALTER TABLE public.pro_crm_customers
  ADD COLUMN IF NOT EXISTS labor_cost_cents_per_hour INTEGER
    CHECK (labor_cost_cents_per_hour IS NULL OR labor_cost_cents_per_hour >= 0);
ALTER TABLE public.business_crew_members
  ADD COLUMN IF NOT EXISTS labor_cost_cents_per_hour INTEGER
    CHECK (labor_cost_cents_per_hour IS NULL OR labor_cost_cents_per_hour >= 0);

-- 3. Hours worked on a job
CREATE TABLE IF NOT EXISTS public.pro_crm_time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.pro_crm_projects(id) ON DELETE CASCADE,
  maintenance_plan_id UUID REFERENCES public.pro_crm_maintenance_plans(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.pro_crm_customers(id) ON DELETE SET NULL,
  crew_member_id UUID REFERENCES public.business_crew_members(id) ON DELETE SET NULL,
  person_name TEXT CHECK (person_name IS NULL OR char_length(person_name) <= 120),
  work_date DATE NOT NULL DEFAULT (CURRENT_DATE),
  hours NUMERIC(6,2) NOT NULL CHECK (hours > 0 AND hours <= 24),
  rate_cents_per_hour INTEGER NOT NULL DEFAULT 0 CHECK (rate_cents_per_hour >= 0),
  note TEXT CHECK (note IS NULL OR char_length(note) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pro_crm_time_entries_job CHECK (project_id IS NOT NULL OR maintenance_plan_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_pro_crm_time_entries_owner ON public.pro_crm_time_entries (owner_id, work_date DESC);
CREATE INDEX IF NOT EXISTS idx_pro_crm_time_entries_project ON public.pro_crm_time_entries (project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pro_crm_time_entries_plan ON public.pro_crm_time_entries (maintenance_plan_id) WHERE maintenance_plan_id IS NOT NULL;

ALTER TABLE public.pro_crm_time_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners manage their time entries" ON public.pro_crm_time_entries;
CREATE POLICY "Owners manage their time entries"
  ON public.pro_crm_time_entries
  FOR ALL
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pro_crm_time_entries TO authenticated;
GRANT ALL ON public.pro_crm_time_entries TO service_role;

-- 4. Owned equipment charged to jobs by the day
ALTER TABLE public.pro_crm_tools
  ADD COLUMN IF NOT EXISTS daily_rate_cents INTEGER
    CHECK (daily_rate_cents IS NULL OR daily_rate_cents >= 0);

-- 5. Overhead % and default crew cost
ALTER TABLE public.pro_invoice_settings
  ADD COLUMN IF NOT EXISTS overhead_percent NUMERIC(5,2) NOT NULL DEFAULT 0
    CHECK (overhead_percent >= 0 AND overhead_percent <= 200),
  ADD COLUMN IF NOT EXISTS default_labor_cost_cents_per_hour INTEGER
    CHECK (default_labor_cost_cents_per_hour IS NULL OR default_labor_cost_cents_per_hour >= 0);

NOTIFY pgrst, 'reload schema';
