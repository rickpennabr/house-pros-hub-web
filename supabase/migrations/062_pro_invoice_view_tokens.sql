-- One-time tokens for public invoice view (email link)
CREATE TABLE IF NOT EXISTS public.pro_invoice_view_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.pro_crm_invoices(id) ON DELETE CASCADE,
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pro_invoice_view_tokens_token ON public.pro_invoice_view_tokens(token);
CREATE INDEX IF NOT EXISTS idx_pro_invoice_view_tokens_invoice_id ON public.pro_invoice_view_tokens(invoice_id);
CREATE INDEX IF NOT EXISTS idx_pro_invoice_view_tokens_expires_at ON public.pro_invoice_view_tokens(expires_at);

ALTER TABLE public.pro_invoice_view_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contractors can create tokens for own invoices"
  ON public.pro_invoice_view_tokens
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pro_crm_invoices i
      WHERE i.id = invoice_id AND i.owner_id = auth.uid()
    )
  );

-- SELECT: only via service role in public API (no policy = denied for anon/auth)
COMMENT ON TABLE public.pro_invoice_view_tokens IS 'Tokens for public invoice view links sent by email.';
