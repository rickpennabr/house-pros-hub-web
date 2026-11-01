-- Stop clients from granting themselves privileged roles, linking a profile
-- to a business they do not own, reading inbound mail, or deleting estimate photos.
-- Shared API rate-limit buckets for multi-instance deployments.

-- ---------------------------------------------------------------------------
-- Profiles: business_id must belong to this profile's user
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_profile_business_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.business_id IS NOT DISTINCT FROM OLD.business_id THEN
    RETURN NEW;
  END IF;

  IF NEW.business_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.businesses b
    WHERE b.id = NEW.business_id
      AND b.owner_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'business_id must reference a business owned by this profile'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS profiles_enforce_business_owner ON public.profiles;
CREATE TRIGGER profiles_enforce_business_owner
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_profile_business_owner();

COMMENT ON FUNCTION public.enforce_profile_business_owner() IS
  'Rejects profile.business_id unless businesses.owner_id matches the profile id. Applies to service role as well.';

-- ---------------------------------------------------------------------------
-- user_roles: customers may self-assign only the customer role
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_user_role_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role text;
BEGIN
  jwt_role := coalesce(auth.role(), '');
  IF jwt_role = 'service_role'
     OR current_user IN ('service_role', 'postgres', 'supabase_admin') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Cannot assign a role to another user' USING ERRCODE = '42501';
    END IF;
    IF NEW.role IS DISTINCT FROM 'customer' THEN
      RAISE EXCEPTION 'Only an invitation can grant this role' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Cannot change role assignment' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_roles_enforce_assignment ON public.user_roles;
CREATE TRIGGER user_roles_enforce_assignment
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_user_role_assignment();

COMMENT ON FUNCTION public.enforce_user_role_assignment() IS
  'Authenticated users may insert only their own customer role. Contractor and realtor rows are written by the service role (invitation signup).';

-- ---------------------------------------------------------------------------
-- Inbound email: no client access. Service role bypasses RLS.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Service role can manage all incoming emails" ON public.incoming_emails;
REVOKE ALL ON TABLE public.incoming_emails FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- Estimate images: anonymous upload/view stay for the public form.
-- Deletion goes through server routes that use the service role.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can delete estimate images" ON storage.objects;

-- ---------------------------------------------------------------------------
-- Shared rate-limit buckets
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  bucket_key text PRIMARY KEY,
  request_count integer NOT NULL,
  reset_at timestamptz NOT NULL
);

ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.api_rate_limits FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_key text,
  p_window_ms integer,
  p_max integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  now_ts timestamptz := now();
  row_count integer;
  row_reset timestamptz;
  retry_after integer;
BEGIN
  IF p_key IS NULL OR length(p_key) = 0 OR p_window_ms <= 0 OR p_max <= 0 THEN
    RAISE EXCEPTION 'invalid rate limit arguments';
  END IF;

  INSERT INTO public.api_rate_limits (bucket_key, request_count, reset_at)
  VALUES (p_key, 1, now_ts + (p_window_ms || ' milliseconds')::interval)
  ON CONFLICT (bucket_key) DO UPDATE
  SET
    request_count = CASE
      WHEN public.api_rate_limits.reset_at <= now_ts THEN 1
      ELSE public.api_rate_limits.request_count + 1
    END,
    reset_at = CASE
      WHEN public.api_rate_limits.reset_at <= now_ts
        THEN now_ts + (p_window_ms || ' milliseconds')::interval
      ELSE public.api_rate_limits.reset_at
    END
  RETURNING request_count, reset_at INTO row_count, row_reset;

  IF random() < 0.02 THEN
    DELETE FROM public.api_rate_limits WHERE reset_at < now_ts - interval '10 minutes';
  END IF;

  retry_after := greatest(1, ceil(extract(epoch FROM (row_reset - now_ts)))::integer);

  RETURN jsonb_build_object(
    'allowed', row_count <= p_max,
    'retry_after_seconds', retry_after
  );
END;
$$;

REVOKE ALL ON FUNCTION public.consume_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(text, integer, integer) TO service_role;

COMMENT ON FUNCTION public.consume_rate_limit(text, integer, integer) IS
  'Atomic per-key rate limit shared across app instances. Service role only.';
