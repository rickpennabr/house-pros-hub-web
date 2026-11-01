-- One place for each fact that was stored twice:
-- invitation codes, personal address, profile-to-business link, and business services.

-- ============================================
-- 1. Invitation codes: one table, role column
-- ============================================
CREATE TABLE IF NOT EXISTS public.invitation_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL CHECK (role IN ('contractor', 'realtor', 'installer')),
  code TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE NULL,
  used_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invitation_codes_code ON public.invitation_codes (code);
CREATE INDEX IF NOT EXISTS idx_invitation_codes_role_created_at
  ON public.invitation_codes (role, created_at DESC);

ALTER TABLE public.invitation_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only for invitation_codes" ON public.invitation_codes;
CREATE POLICY "Service role only for invitation_codes"
  ON public.invitation_codes FOR ALL
  USING (false)
  WITH CHECK (false);

REVOKE ALL ON TABLE public.invitation_codes FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.invitation_codes TO service_role;

COMMENT ON TABLE public.invitation_codes IS
  'One-time invitation codes for contractor, realtor, and installer signup.';

DO $$
BEGIN
  IF to_regclass('public.contractor_invitation_codes') IS NOT NULL THEN
    INSERT INTO public.invitation_codes (id, role, code, created_at, expires_at, used_at, used_by)
    SELECT id, 'contractor', code, created_at, expires_at, used_at, used_by
    FROM public.contractor_invitation_codes
    ON CONFLICT (code) DO NOTHING;
  END IF;
  IF to_regclass('public.realtor_invitation_codes') IS NOT NULL THEN
    INSERT INTO public.invitation_codes (id, role, code, created_at, expires_at, used_at, used_by)
    SELECT id, 'realtor', code, created_at, expires_at, used_at, used_by
    FROM public.realtor_invitation_codes
    ON CONFLICT (code) DO NOTHING;
  END IF;
  IF to_regclass('public.installer_invitation_codes') IS NOT NULL THEN
    INSERT INTO public.invitation_codes (id, role, code, created_at, expires_at, used_at, used_by)
    SELECT id, 'installer', code, created_at, expires_at, used_at, used_by
    FROM public.installer_invitation_codes
    ON CONFLICT (code) DO NOTHING;
  END IF;
END $$;

DROP TABLE IF EXISTS public.contractor_invitation_codes;
DROP TABLE IF EXISTS public.realtor_invitation_codes;
DROP TABLE IF EXISTS public.installer_invitation_codes;

-- ============================================
-- 2. profiles.business_id must be a business this user owns
-- ============================================
UPDATE public.profiles p
SET business_id = NULL
WHERE p.business_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = p.business_id AND b.owner_id = p.id
  );

CREATE OR REPLACE FUNCTION public.enforce_profile_business_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.business_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = NEW.business_id AND b.owner_id = NEW.id
  ) THEN
    RAISE EXCEPTION 'profiles.business_id must reference a business owned by this user';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_enforce_business_owner ON public.profiles;
CREATE TRIGGER profiles_enforce_business_owner
  BEFORE INSERT OR UPDATE OF business_id ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_profile_business_owner();

CREATE OR REPLACE FUNCTION public.detach_profile_business_on_owner_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    UPDATE public.profiles
    SET business_id = NULL
    WHERE business_id = NEW.id AND id IS DISTINCT FROM NEW.owner_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS businesses_detach_profile_pointer ON public.businesses;
CREATE TRIGGER businesses_detach_profile_pointer
  AFTER UPDATE OF owner_id ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.detach_profile_business_on_owner_change();

COMMENT ON COLUMN public.profiles.business_id IS
  'Optional pointer to one business this user owns. Account type lives in user_roles, not here.';

-- ============================================
-- 3. Personal address lives only in addresses
-- ============================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'street_address'
  ) THEN
    INSERT INTO public.addresses (
      user_id, address_type, street_address, apartment, city, state, zip_code,
      gate_code, address_note, is_public, is_verified, created_at, updated_at
    )
    SELECT
      p.id, 'personal',
      NULLIF(p.street_address, ''), NULLIF(p.apartment, ''), NULLIF(p.city, ''),
      NULLIF(p.state, ''), NULLIF(p.zip_code, ''), NULLIF(p.gate_code, ''),
      NULLIF(p.address_note, ''),
      false, false, p.created_at, p.updated_at
    FROM public.profiles p
    WHERE COALESCE(NULLIF(p.street_address, ''), NULLIF(p.city, ''), NULLIF(p.state, ''), NULLIF(p.zip_code, '')) IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.addresses a
        WHERE a.user_id = p.id AND a.address_type = 'personal'
      );
  END IF;
END $$;

DELETE FROM public.addresses a
USING (
  SELECT id, row_number() OVER (
    PARTITION BY user_id
    ORDER BY updated_at DESC NULLS LAST, created_at DESC
  ) AS rn
  FROM public.addresses
  WHERE address_type = 'personal'
) ranked
WHERE a.id = ranked.id AND ranked.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_addresses_one_personal
  ON public.addresses (user_id)
  WHERE address_type = 'personal';

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS street_address,
  DROP COLUMN IF EXISTS apartment,
  DROP COLUMN IF EXISTS city,
  DROP COLUMN IF EXISTS state,
  DROP COLUMN IF EXISTS zip_code,
  DROP COLUMN IF EXISTS gate_code,
  DROP COLUMN IF EXISTS address_note;

-- Digits-only phone for lookup. Not unique: the same number can exist on more than one account today.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_digits TEXT
  GENERATED ALWAYS AS (NULLIF(regexp_replace(COALESCE(phone, ''), '\D', '', 'g'), '')) STORED;

CREATE INDEX IF NOT EXISTS idx_profiles_phone_digits
  ON public.profiles (phone_digits)
  WHERE phone_digits IS NOT NULL;

-- ============================================
-- 4. Business services as rows, kept in sync with the JSON array
-- ============================================
CREATE TABLE IF NOT EXISTS public.business_services (
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  PRIMARY KEY (business_id, service_name)
);

CREATE INDEX IF NOT EXISTS idx_business_services_name_trgm
  ON public.business_services USING gin (service_name gin_trgm_ops);

ALTER TABLE public.business_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view business services" ON public.business_services;
CREATE POLICY "Public can view business services"
  ON public.business_services FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_services.business_id AND b.is_active = true
    )
  );

DROP POLICY IF EXISTS "Owners can manage business services" ON public.business_services;
CREATE POLICY "Owners can manage business services"
  ON public.business_services FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_services.business_id AND b.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_services.business_id AND b.owner_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.sync_business_services()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.business_services WHERE business_id = NEW.id;
  IF jsonb_typeof(COALESCE(NEW.services, '[]'::jsonb)) = 'array' THEN
    INSERT INTO public.business_services (business_id, service_name)
    SELECT NEW.id, left(btrim(value), 120)
    FROM jsonb_array_elements_text(COALESCE(NEW.services, '[]'::jsonb)) AS value
    WHERE btrim(value) <> ''
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS businesses_sync_services ON public.businesses;
CREATE TRIGGER businesses_sync_services
  AFTER INSERT OR UPDATE OF services ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_business_services();

INSERT INTO public.business_services (business_id, service_name)
SELECT b.id, left(btrim(value), 120)
FROM public.businesses b
CROSS JOIN LATERAL jsonb_array_elements_text(
  CASE
    WHEN jsonb_typeof(COALESCE(b.services, '[]'::jsonb)) = 'array' THEN COALESCE(b.services, '[]'::jsonb)
    ELSE '[]'::jsonb
  END
) AS value
WHERE btrim(value) <> ''
ON CONFLICT DO NOTHING;

GRANT SELECT ON TABLE public.business_services TO anon, authenticated;
GRANT ALL ON TABLE public.business_services TO service_role;

DROP INDEX IF EXISTS public.idx_businesses_services_trgm;

CREATE INDEX IF NOT EXISTS idx_addresses_city_trgm
  ON public.addresses USING gin (city gin_trgm_ops)
  WHERE city IS NOT NULL;

-- Directory search matches service rows instead of scanning the JSON blob.
CREATE OR REPLACE FUNCTION public.list_directory_business_ids(
  search text,
  license_types text[],
  category_name text,
  lim integer,
  off integer
)
RETURNS TABLE (id uuid, total_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH matched AS (
    SELECT b.id, b.display_order, b.created_at
    FROM public.businesses b
    WHERE b.is_active IS TRUE
      AND (
        search IS NULL
        OR btrim(search) = ''
        OR b.business_name ILIKE '%' || search || '%'
        OR COALESCE(b.company_description, '') ILIKE '%' || search || '%'
        OR EXISTS (
          SELECT 1 FROM public.business_services s
          WHERE s.business_id = b.id
            AND s.service_name ILIKE '%' || search || '%'
        )
        OR EXISTS (
          SELECT 1
          FROM public.licenses l
          WHERE l.business_id = b.id
            AND (
              COALESCE(l.license_name, '') ILIKE '%' || search || '%'
              OR COALESCE(l.license_type, '') ILIKE '%' || search || '%'
            )
        )
      )
      AND (
        (
          (license_types IS NULL OR cardinality(license_types) = 0)
          AND (category_name IS NULL OR btrim(category_name) = '')
        )
        OR EXISTS (
          SELECT 1
          FROM public.licenses l
          WHERE l.business_id = b.id
            AND (
              (
                license_types IS NOT NULL
                AND cardinality(license_types) > 0
                AND l.license_type = ANY(license_types)
              )
              OR (
                category_name IS NOT NULL
                AND btrim(category_name) <> ''
                AND l.license_name ILIKE category_name
              )
            )
        )
      )
  ),
  counted AS (
    SELECT COUNT(*)::bigint AS total_count FROM matched
  )
  SELECT page.id, counted.total_count
  FROM counted
  LEFT JOIN LATERAL (
    SELECT m.id
    FROM matched m
    ORDER BY m.display_order ASC NULLS LAST, m.created_at DESC
    LIMIT GREATEST(COALESCE(lim, 0), 0)
    OFFSET GREATEST(COALESCE(off, 0), 0)
  ) page ON true;
$$;

REVOKE ALL ON FUNCTION public.list_directory_business_ids(text, text[], text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_directory_business_ids(text, text[], text, integer, integer) TO anon, authenticated, service_role;
