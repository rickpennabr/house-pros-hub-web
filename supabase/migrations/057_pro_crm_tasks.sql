-- ProsCRM: tasks/appointments (estimate appointment, business meeting, follow up, other).
-- Used by contractor, office staff, or hub to book appointments on behalf of the pro.
CREATE TABLE IF NOT EXISTS public.pro_crm_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL CHECK (task_type IN ('estimate_appointment', 'business_meeting', 'follow_up', 'other')),
  other_label TEXT,
  customer_id UUID REFERENCES public.pro_crm_customers(id) ON DELETE SET NULL,
  meeting_with TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT pro_crm_tasks_end_after_start CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS idx_pro_crm_tasks_owner_id ON public.pro_crm_tasks(owner_id);
CREATE INDEX IF NOT EXISTS idx_pro_crm_tasks_start_at ON public.pro_crm_tasks(start_at);
CREATE INDEX IF NOT EXISTS idx_pro_crm_tasks_customer_id ON public.pro_crm_tasks(customer_id);

CREATE TRIGGER update_pro_crm_tasks_updated_at
  BEFORE UPDATE ON public.pro_crm_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.pro_crm_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contractors can manage own tasks"
  ON public.pro_crm_tasks
  FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

COMMENT ON TABLE public.pro_crm_tasks IS 'ProsCRM: tasks/appointments (estimate, meeting, follow up, other).';
