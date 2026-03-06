-- ProsCRM: projects (jobs) linked to customers and optional estimate
CREATE TABLE IF NOT EXISTS public.pro_crm_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.pro_crm_customers(id) ON DELETE CASCADE,
  estimate_id UUID REFERENCES public.pro_crm_estimates(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'on_hold', 'completed', 'cancelled')),
  start_date DATE,
  end_date DATE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pro_crm_projects_owner_id ON public.pro_crm_projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_pro_crm_projects_customer_id ON public.pro_crm_projects(customer_id);
CREATE INDEX IF NOT EXISTS idx_pro_crm_projects_created_at ON public.pro_crm_projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pro_crm_projects_status ON public.pro_crm_projects(status);

CREATE TRIGGER update_pro_crm_projects_updated_at
  BEFORE UPDATE ON public.pro_crm_projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.pro_crm_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contractors can manage own CRM projects"
  ON public.pro_crm_projects
  FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

COMMENT ON TABLE public.pro_crm_projects IS 'ProsCRM: jobs/projects linked to CRM customers.';
