-- One-time invitation codes for installer signup.
-- Same shape as realtor_invitation_codes. Admin generates them.

CREATE TABLE IF NOT EXISTS public.installer_invitation_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE NULL,
  used_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_installer_invitation_codes_code ON public.installer_invitation_codes(code);
CREATE INDEX IF NOT EXISTS idx_installer_invitation_codes_expires_at ON public.installer_invitation_codes(expires_at);

ALTER TABLE public.installer_invitation_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only for installer_invitation_codes"
  ON public.installer_invitation_codes FOR ALL
  USING (false)
  WITH CHECK (false);

COMMENT ON TABLE public.installer_invitation_codes IS 'One-time-use invitation codes for installer signup; generated in admin, validated at signup.';
