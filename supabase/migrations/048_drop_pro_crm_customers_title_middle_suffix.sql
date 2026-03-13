-- Remove Title, middle name, and suffix from pro_crm_customers (no longer used in UI)
ALTER TABLE public.pro_crm_customers DROP COLUMN IF EXISTS title;
ALTER TABLE public.pro_crm_customers DROP COLUMN IF EXISTS middle_name;
ALTER TABLE public.pro_crm_customers DROP COLUMN IF EXISTS suffix;
