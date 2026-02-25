-- ============================================
-- Migration 014: Contractor invitation codes
-- ============================================
-- One-time-use codes for contractor signup; admin generates, contractor enters at signup.
-- Codes expire after 30 days (set at generation).
-- ============================================

CREATE TABLE IF NOT EXISTS public.contractor_invitation_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE NULL,
  used_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_contractor_invitation_codes_code ON public.contractor_invitation_codes(code);
CREATE INDEX IF NOT EXISTS idx_contractor_invitation_codes_expires_at ON public.contractor_invitation_codes(expires_at);

ALTER TABLE public.contractor_invitation_codes ENABLE ROW LEVEL SECURITY;

-- No direct anon/authenticated access; API uses service role for admin generate/list and signup validate/update
CREATE POLICY "Service role only for contractor_invitation_codes"
  ON public.contractor_invitation_codes FOR ALL
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.contractor_invitation_codes IS 'One-time-use invitation codes for contractor signup; generated in admin, validated at signup.';
