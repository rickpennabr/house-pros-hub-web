-- Security audit 2026-11-20: proof of email ownership.
--
-- Signup marks the Supabase email as confirmed right away (so people are signed in instantly),
-- which means email_confirmed_at does NOT prove the person owns the address. Anything that hands
-- out data by email (the CRM auto-claim in My Places) must use profiles.verified_email instead:
-- it is set only when the person clicks our verification link, opens a password-reset link, or
-- signs in with Google (Google verified the address). It stores the address that was proven, so
-- changing the account email makes it unverified again.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS verified_email TEXT,
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.verified_email IS
  'Lowercased email the person proved they own (verification link, reset link, or Google). Compare with auth.users.email.';

-- Accounts that already sign in with Google proved their address through Google.
UPDATE public.profiles p
SET verified_email = lower(u.email), email_verified_at = now()
FROM auth.users u
WHERE p.id = u.id
  AND p.verified_email IS NULL
  AND u.email IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM auth.identities i
    WHERE i.user_id = u.id AND i.provider = 'google'
      AND lower(i.identity_data->>'email') = lower(u.email)
  );

-- Ends every session of a user except one (used after Google sign-in proves the address
-- belongs to someone else than whoever set the password). Service role only.
CREATE OR REPLACE FUNCTION public.revoke_other_sessions(p_user_id UUID, p_keep_session_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  removed INTEGER;
BEGIN
  DELETE FROM auth.sessions
  WHERE user_id = p_user_id
    AND (p_keep_session_id IS NULL OR id <> p_keep_session_id);
  GET DIAGNOSTICS removed = ROW_COUNT;
  RETURN removed;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_other_sessions(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_other_sessions(UUID, UUID) TO service_role;

-- People can update their own profile row from the browser. They must never be able to mark
-- their own email as verified: only the server (service role) may change these two columns.
CREATE OR REPLACE FUNCTION public.protect_verified_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin', 'service_role') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.verified_email := NULL;
      NEW.email_verified_at := NULL;
    ELSE
      NEW.verified_email := OLD.verified_email;
      NEW.email_verified_at := OLD.email_verified_at;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_verified_email ON public.profiles;
CREATE TRIGGER protect_verified_email
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_verified_email();
