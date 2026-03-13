-- Remove sales_form_delivery_options and tax_exemption_details from pro_crm_customers (no longer used in UI)
ALTER TABLE public.pro_crm_customers DROP COLUMN IF EXISTS sales_form_delivery_options;
ALTER TABLE public.pro_crm_customers DROP COLUMN IF EXISTS tax_exemption_details;
