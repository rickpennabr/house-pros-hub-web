-- Handymen are people, not directory businesses.
-- They get a shareable details page for small repairs and projects. They do not get a public card.

ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_role_check
  CHECK (role IN ('customer', 'contractor', 'realtor', 'installer', 'handyman'));

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'invitation_codes'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%role%';
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.invitation_codes DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.invitation_codes ADD CONSTRAINT invitation_codes_role_check
  CHECK (role IN ('contractor', 'realtor', 'installer', 'handyman'));

CREATE TABLE IF NOT EXISTS public.handyman_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  photo_url TEXT,
  phone TEXT,
  email TEXT,
  bio TEXT,
  trades TEXT[] NOT NULL DEFAULT '{}',
  service_area TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  CONSTRAINT handyman_profiles_slug_length CHECK (char_length(slug) BETWEEN 3 AND 80),
  CONSTRAINT handyman_profiles_name_length CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 120)
);

CREATE INDEX IF NOT EXISTS idx_handyman_profiles_slug ON public.handyman_profiles (slug);

ALTER TABLE public.handyman_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS handyman_profiles_public_read ON public.handyman_profiles;
CREATE POLICY handyman_profiles_public_read
  ON public.handyman_profiles
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS handyman_profiles_owner_write ON public.handyman_profiles;
CREATE POLICY handyman_profiles_owner_write
  ON public.handyman_profiles
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON TABLE public.handyman_profiles IS
  'Shareable handyman details for small repairs and projects. Not a directory card.';

ALTER TABLE public.admin_notification_events DROP CONSTRAINT IF EXISTS admin_notification_events_entity_type_check;
ALTER TABLE public.admin_notification_events
  ADD CONSTRAINT admin_notification_events_entity_type_check
  CHECK (entity_type IN (
    'customer',
    'contractor',
    'realtor',
    'installer',
    'handyman',
    'business',
    'estimate',
    'booking',
    'email'
  ));
