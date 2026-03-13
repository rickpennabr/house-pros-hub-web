-- Remove short "note" column from pro_crm_customers (UI uses only "notes" / Additional notes)
ALTER TABLE public.pro_crm_customers DROP COLUMN IF EXISTS note;
