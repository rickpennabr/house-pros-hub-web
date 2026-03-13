-- Remove custom_fields from pro_crm_customers (feature removed from UI)
ALTER TABLE public.pro_crm_customers DROP COLUMN IF EXISTS custom_fields;
