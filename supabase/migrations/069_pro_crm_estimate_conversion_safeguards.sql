-- Add invoice conversion metadata and prevent duplicate invoice conversions per estimate.
ALTER TABLE public.pro_crm_invoices
  ADD COLUMN IF NOT EXISTS converted_from_estimate_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS converted_from_estimate_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pro_crm_invoices_owner_estimate_unique
  ON public.pro_crm_invoices(owner_id, estimate_id)
  WHERE estimate_id IS NOT NULL;
