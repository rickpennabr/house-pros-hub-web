-- Materials and equipment expenses can name the contact they were bought from,
-- and every expense can store a description that later expenses can reuse.

ALTER TABLE public.pro_crm_expenses
  ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.pro_crm_customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS description TEXT;

CREATE INDEX IF NOT EXISTS idx_pro_crm_expenses_supplier_id
  ON public.pro_crm_expenses(supplier_id);

COMMENT ON COLUMN public.pro_crm_expenses.supplier_id IS
  'Contact this materials or equipment expense was bought from.';
COMMENT ON COLUMN public.pro_crm_expenses.description IS
  'What was purchased. Previous descriptions are offered again on later expenses.';
