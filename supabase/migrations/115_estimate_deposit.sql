-- Optional deposit collected when a sent estimate is accepted.
-- It is billed as the first invoice against the estimate.
ALTER TABLE public.pro_crm_estimates
  ADD COLUMN IF NOT EXISTS deposit_cents INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.pro_crm_estimates
  DROP CONSTRAINT IF EXISTS pro_crm_estimates_deposit_cents_check;

ALTER TABLE public.pro_crm_estimates
  ADD CONSTRAINT pro_crm_estimates_deposit_cents_check
  CHECK (deposit_cents >= 0);

COMMENT ON COLUMN public.pro_crm_estimates.deposit_cents IS
  'Amount due when the customer accepts. Zero means no deposit. Billed as the first invoice.';
