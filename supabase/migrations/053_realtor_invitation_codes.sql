-- ============================================
-- Migration 053: Realtor invitation codes
-- ============================================
-- One-time-use codes for realtor signup; admin generates, realtor enters at signup.
-- Codes expire after 30 days (set at generation). Same structure as contractor_invitation_codes.
-- ============================================

CREATE TABLE IF NOT EXISTS public.realtor_invitation_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE NULL,
  used_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_realtor_invitation_codes_code ON public.realtor_invitation_codes(code);
CREATE INDEX IF NOT EXISTS idx_realtor_invitation_codes_expires_at ON public.realtor_invitation_codes(expires_at);

ALTER TABLE public.realtor_invitation_codes ENABLE ROW LEVEL SECURITY;

-- No direct anon/authenticated access; API uses service role for admin generate/list and signup validate/update
CREATE POLICY "Service role only for realtor_invitation_codes"
  ON public.realtor_invitation_codes FOR ALL
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.realtor_invitation_codes IS 'One-time-use invitation codes for realtor signup; generated in admin, validated at signup.';
