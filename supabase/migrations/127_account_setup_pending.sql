-- New Google customers stay out of the Hub until they answer how they
-- heard about us, add a phone number, and accept the terms.
-- Existing accounts stay false, so this does not lock anyone out.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_setup_pending BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.account_setup_pending IS
  'True while a new Google customer still needs referral, phone, and terms before entering the Hub.';

-- Only the server (service role) may flip this flag. A signed-in person can
-- still update their name, phone, and photo.
CREATE OR REPLACE FUNCTION public.protect_account_setup_pending()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF coalesce(auth.role(), '') = 'service_role'
     OR current_user IN ('service_role', 'postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.account_setup_pending IS DISTINCT FROM OLD.account_setup_pending THEN
    NEW.account_setup_pending := OLD.account_setup_pending;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_account_setup_pending ON public.profiles;
CREATE TRIGGER profiles_protect_account_setup_pending
  BEFORE UPDATE OF account_setup_pending ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_account_setup_pending();
