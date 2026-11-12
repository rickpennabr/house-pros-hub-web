-- Progress billing: several invoices can draw on one estimate.
-- Cancelled invoices do not count, so the unique "one invoice per estimate" lock goes away.
DROP INDEX IF EXISTS idx_pro_crm_invoices_owner_estimate_unique;

-- A job cost is unbilled until an invoice includes it. Cancelling or deleting that invoice frees it.
ALTER TABLE public.pro_crm_expenses
  ADD COLUMN IF NOT EXISTS billed_invoice_id UUID REFERENCES public.pro_crm_invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS billed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_pro_crm_expenses_billed_invoice
  ON public.pro_crm_expenses (billed_invoice_id)
  WHERE billed_invoice_id IS NOT NULL;

COMMENT ON COLUMN public.pro_crm_expenses.billed_invoice_id IS
  'Invoice that included this cost. Null means it can still be billed to the customer.';

-- Due-soon mail is separate from the weekly past-due reminder.
ALTER TABLE public.pro_crm_invoices
  ADD COLUMN IF NOT EXISTS due_soon_reminded_at TIMESTAMPTZ;

COMMENT ON COLUMN public.pro_crm_invoices.due_soon_reminded_at IS
  'When the customer was emailed that this invoice is coming due. Past-due reminders use last_reminded_at.';
