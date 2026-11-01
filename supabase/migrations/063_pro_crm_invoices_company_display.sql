-- Allow per-invoice override of company information (e.g. DBA vs legal entity for payment).
-- When set, these values override the business fetched from business_id on the invoice.
ALTER TABLE public.pro_crm_invoices
  ADD COLUMN IF NOT EXISTS company_display JSONB;

COMMENT ON COLUMN public.pro_crm_invoices.company_display IS 'Optional override for company info on this invoice: business_name, address, email, phone, website, business_logo, company_tagline. Used when payment should go to a different entity than the default business.';
