-- A trip can be tied to the customer it was driven for, and to one of that customer's estimates.

ALTER TABLE public.pro_crm_mileage_trips
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.pro_crm_customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS estimate_id UUID REFERENCES public.pro_crm_estimates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pro_crm_mileage_trips_customer
  ON public.pro_crm_mileage_trips(customer_id);
CREATE INDEX IF NOT EXISTS idx_pro_crm_mileage_trips_estimate
  ON public.pro_crm_mileage_trips(estimate_id);

COMMENT ON COLUMN public.pro_crm_mileage_trips.customer_id IS
  'Customer this drive was for. Set from the estimate when an estimate is chosen.';
COMMENT ON COLUMN public.pro_crm_mileage_trips.estimate_id IS
  'Estimate this drive belongs to. The estimate customer is stored on customer_id.';
