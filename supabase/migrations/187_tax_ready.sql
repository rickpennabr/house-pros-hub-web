-- Tax-ready books.
-- W-9 on file for subcontractors (1099-NEC). Only the last 4 digits of the tax ID are kept:
-- the full SSN/EIN stays on the W-9 file itself, never in a column.
-- payment_method on expenses: card payments are left out of 1099-NEC (they go on the card company's 1099-K).

ALTER TABLE public.pro_crm_customers
  ADD COLUMN IF NOT EXISTS w9_received_at DATE,
  ADD COLUMN IF NOT EXISTS tax_id_last4 TEXT
    CHECK (tax_id_last4 IS NULL OR tax_id_last4 ~ '^[0-9]{4}$');

ALTER TABLE public.pro_crm_expenses
  ADD COLUMN IF NOT EXISTS payment_method TEXT
    CHECK (payment_method IS NULL OR payment_method IN ('cash', 'check', 'card', 'transfer', 'other'));

COMMENT ON COLUMN public.pro_crm_customers.w9_received_at IS 'Date the W-9 was received (subcontractors, 1099-NEC).';
COMMENT ON COLUMN public.pro_crm_customers.tax_id_last4 IS 'Last 4 digits of the SSN/EIN from the W-9. Never the full number.';
COMMENT ON COLUMN public.pro_crm_expenses.payment_method IS 'How the expense was paid. Card payments do not count toward 1099-NEC.';
