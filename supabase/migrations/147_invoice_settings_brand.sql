-- Invoice settings: own logo, default payment terms and message, and a footer on every invoice.
ALTER TABLE public.pro_invoice_settings
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS default_payment_terms TEXT CHECK (default_payment_terms IS NULL OR char_length(default_payment_terms) <= 60),
  ADD COLUMN IF NOT EXISTS default_note TEXT CHECK (default_note IS NULL OR char_length(default_note) <= 2000),
  ADD COLUMN IF NOT EXISTS footer_text TEXT CHECK (footer_text IS NULL OR char_length(footer_text) <= 2000);

COMMENT ON COLUMN public.pro_invoice_settings.logo_url IS 'Logo on invoices. NULL: the default business logo.';
COMMENT ON COLUMN public.pro_invoice_settings.default_payment_terms IS 'Terms on new invoices, e.g. Due on receipt, Net 30.';
COMMENT ON COLUMN public.pro_invoice_settings.default_note IS 'Message to the customer prefilled on new invoices.';
COMMENT ON COLUMN public.pro_invoice_settings.footer_text IS 'Footer on every invoice: payment instructions, terms and conditions.';
