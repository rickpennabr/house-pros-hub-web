-- One-time tokens for public estimate view/approval (email link)
CREATE TABLE IF NOT EXISTS public.pro_estimate_view_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID NOT NULL REFERENCES public.pro_crm_estimates(id) ON DELETE CASCADE,
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pro_estimate_view_tokens_token
  ON public.pro_estimate_view_tokens(token);
CREATE INDEX IF NOT EXISTS idx_pro_estimate_view_tokens_estimate_id
  ON public.pro_estimate_view_tokens(estimate_id);
CREATE INDEX IF NOT EXISTS idx_pro_estimate_view_tokens_expires_at
  ON public.pro_estimate_view_tokens(expires_at);

ALTER TABLE public.pro_estimate_view_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contractors can create tokens for own estimates"
  ON public.pro_estimate_view_tokens
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pro_crm_estimates e
      WHERE e.id = estimate_id AND e.owner_id = auth.uid()
    )
  );

-- SELECT is intentionally denied for anon/auth users.
COMMENT ON TABLE public.pro_estimate_view_tokens IS 'Tokens for public estimate view/approval links sent by email.';
