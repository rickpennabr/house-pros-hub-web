-- Remove "Name to print on checks" from pro_crm_customers (no longer used)
ALTER TABLE public.pro_crm_customers DROP COLUMN IF EXISTS name_on_checks;
