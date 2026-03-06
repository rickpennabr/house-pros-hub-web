-- ProsCRM: expense entries, optional link to project
CREATE TABLE IF NOT EXISTS public.pro_crm_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.pro_crm_projects(id) ON DELETE SET NULL,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'other',
  expense_date DATE NOT NULL DEFAULT (CURRENT_DATE),
  note TEXT,
  receipt_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pro_crm_expenses_owner_id ON public.pro_crm_expenses(owner_id);
CREATE INDEX IF NOT EXISTS idx_pro_crm_expenses_project_id ON public.pro_crm_expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_pro_crm_expenses_expense_date ON public.pro_crm_expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_pro_crm_expenses_category ON public.pro_crm_expenses(category);

CREATE TRIGGER update_pro_crm_expenses_updated_at
  BEFORE UPDATE ON public.pro_crm_expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.pro_crm_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contractors can manage own CRM expenses"
  ON public.pro_crm_expenses
  FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

COMMENT ON TABLE public.pro_crm_expenses IS 'ProsCRM: expense entries, optionally linked to a project.';
