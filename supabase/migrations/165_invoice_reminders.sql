-- Invoice payment reminders.
-- payment_instructions: how customers can pay besides card (e.g. "Zelle: name@example.com"), shown on reminder emails.
-- reminder_message: default friendly note on reminder emails.
ALTER TABLE public.pro_invoice_settings ADD COLUMN IF NOT EXISTS payment_instructions TEXT;
ALTER TABLE public.pro_invoice_settings ADD COLUMN IF NOT EXISTS reminder_message TEXT;

-- Company info printed on every invoice header (each blank one falls back to the business profile).
ALTER TABLE public.pro_invoice_settings ADD COLUMN IF NOT EXISTS company_address TEXT;
ALTER TABLE public.pro_invoice_settings ADD COLUMN IF NOT EXISTS company_email TEXT;
ALTER TABLE public.pro_invoice_settings ADD COLUMN IF NOT EXISTS company_phone TEXT;
ALTER TABLE public.pro_invoice_settings ADD COLUMN IF NOT EXISTS company_website TEXT;

