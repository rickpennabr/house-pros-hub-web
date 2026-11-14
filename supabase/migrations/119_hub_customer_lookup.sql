-- Exact-email lookup of a confirmed House Pros customer account.
-- Returns the person's own profile, personal address, and places.
-- Does not read any contractor's CRM contacts.
-- Only the service role may call it. Pros reach it through the app API, which checks the caller and rate-limits.

CREATE OR REPLACE FUNCTION public.hub_customer_contact_by_email(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  normalized text;
  found_id uuid;
  result jsonb;
BEGIN
  normalized := lower(btrim(coalesce(p_email, '')));
  IF char_length(normalized) = 0
     OR char_length(normalized) > 320
     OR normalized !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RETURN NULL;
  END IF;

  SELECT u.id
  INTO found_id
  FROM auth.users u
  WHERE lower(u.email) = normalized
    AND u.email_confirmed_at IS NOT NULL
    AND (u.banned_until IS NULL OR u.banned_until <= now())
    AND EXISTS (
      SELECT 1
      FROM public.user_roles r
      WHERE r.user_id = u.id
        AND r.role = 'customer'
        AND r.is_active = true
    )
  LIMIT 1;

  IF found_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'user_id', found_id,
    'email', normalized,
    'first_name', p.first_name,
    'last_name', p.last_name,
    'phone', p.phone,
    'street_address', a.street_address,
    'apartment', a.apartment,
    'city', a.city,
    'state', a.state,
    'zip_code', a.zip_code,
    'places', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', cp.id,
            'kind', cp.kind,
            'name', cp.name,
            'street', cp.street,
            'city', cp.city,
            'state', cp.state,
            'zip_code', cp.zip_code
          )
          ORDER BY cp.created_at
        )
        FROM public.customer_places cp
        WHERE cp.user_id = found_id
      ),
      '[]'::jsonb
    )
  )
  INTO result
  FROM public.profiles p
  LEFT JOIN LATERAL (
    SELECT street_address, apartment, city, state, zip_code
    FROM public.addresses
    WHERE user_id = found_id
      AND address_type = 'personal'
    ORDER BY created_at
    LIMIT 1
  ) a ON true
  WHERE p.id = found_id;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.hub_customer_contact_by_email(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hub_customer_contact_by_email(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hub_customer_contact_by_email(text) TO service_role;

COMMENT ON FUNCTION public.hub_customer_contact_by_email(text) IS
  'Service-role lookup of one confirmed customer by exact email. Profile, personal address, and places only. No CRM rows, gate codes, or address notes.';
