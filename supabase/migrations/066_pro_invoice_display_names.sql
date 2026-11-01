-- ProsCRM: custom display names for invoice "Default business" (name-only, no full business record)
CREATE TABLE IF NOT EXISTS public.pro_invoice_display_names (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pro_invoice_display_names_owner_id
  ON public.pro_invoice_display_names(owner_id);

ALTER TABLE public.pro_invoice_display_names ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contractors can manage own invoice display names"
  ON public.pro_invoice_display_names
  FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

COMMENT ON TABLE public.pro_invoice_display_names IS 'ProsCRM: custom company names for invoice header (display only, not linked to businesses table).';

-- Allow invoice settings to default to a display name instead of a business
ALTER TABLE public.pro_invoice_settings
  ADD COLUMN IF NOT EXISTS default_display_name_id UUID REFERENCES public.pro_invoice_display_names(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.pro_invoice_settings.default_display_name_id IS 'When set, this display name is used as company name on invoices instead of default_business_id.';
