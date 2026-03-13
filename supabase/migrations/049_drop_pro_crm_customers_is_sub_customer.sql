-- Remove is_sub_customer from pro_crm_customers (feature removed from UI)
ALTER TABLE public.pro_crm_customers DROP COLUMN IF EXISTS is_sub_customer;
