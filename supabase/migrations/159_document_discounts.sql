-- Discounts on estimates and invoices, as in QuickBooks: a percent of the subtotal or a dollar
-- amount. The lines keep their full prices. amount_cents stays the total the customer pays
-- (subtotal minus discount_cents), so payments, deposits and reports need no change.

ALTER TABLE public.pro_crm_estimates
  ADD COLUMN IF NOT EXISTS discount_kind TEXT,
  ADD COLUMN IF NOT EXISTS discount_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_cents INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.pro_crm_invoices
  ADD COLUMN IF NOT EXISTS discount_kind TEXT,
  ADD COLUMN IF NOT EXISTS discount_value NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_cents INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pro_crm_estimates_discount_check') THEN
    ALTER TABLE public.pro_crm_estimates ADD CONSTRAINT pro_crm_estimates_discount_check CHECK (
      (discount_kind IS NULL OR discount_kind IN ('percent', 'amount'))
      AND discount_value >= 0
      AND (discount_kind IS DISTINCT FROM 'percent' OR discount_value <= 100)
      AND discount_cents >= 0
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pro_crm_invoices_discount_check') THEN
    ALTER TABLE public.pro_crm_invoices ADD CONSTRAINT pro_crm_invoices_discount_check CHECK (
      (discount_kind IS NULL OR discount_kind IN ('percent', 'amount'))
      AND discount_value >= 0
      AND (discount_kind IS DISTINCT FROM 'percent' OR discount_value <= 100)
      AND discount_cents >= 0
    );
  END IF;
END $$;

COMMENT ON COLUMN public.pro_crm_estimates.discount_cents IS 'Taken off the line subtotal; amount_cents is the total after it.';
COMMENT ON COLUMN public.pro_crm_invoices.discount_cents IS 'Taken off the line subtotal; amount_cents is the total after it.';
