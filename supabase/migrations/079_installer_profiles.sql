-- Installers are people, not directory businesses.
-- They get a shareable details page. They do not get a public card.

ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;

ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_role_check
  CHECK (role IN ('customer', 'contractor', 'realtor', 'installer'));

CREATE TABLE IF NOT EXISTS public.installer_profiles (
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
  CONSTRAINT installer_profiles_slug_length CHECK (char_length(slug) BETWEEN 3 AND 80),
  CONSTRAINT installer_profiles_name_length CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 120)
);

CREATE INDEX IF NOT EXISTS idx_installer_profiles_slug ON public.installer_profiles (slug);

ALTER TABLE public.installer_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS installer_profiles_public_read ON public.installer_profiles;
CREATE POLICY installer_profiles_public_read
  ON public.installer_profiles
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS installer_profiles_owner_write ON public.installer_profiles;
CREATE POLICY installer_profiles_owner_write
  ON public.installer_profiles
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

COMMENT ON TABLE public.installer_profiles IS
  'Shareable installer details. Not a directory card. Contractors and realtors stay on businesses.';
