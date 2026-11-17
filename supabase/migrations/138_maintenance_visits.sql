-- On-site maintenance visits: timer, ProCam package, service chips, crew, PDF report.
-- Extends existing pro_crm_maintenance_plans (commercial agreement) with visit logging.

-- ============================================
-- 1. Business crew (Hub login via owner invite)
-- ============================================
CREATE TABLE IF NOT EXISTS public.business_crew_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.pro_crm_customers(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  member_role TEXT NOT NULL DEFAULT 'crew' CHECK (member_role IN ('crew', 'lead')),
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'disabled')),
  invite_token TEXT UNIQUE,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT business_crew_members_email_len CHECK (char_length(email) BETWEEN 3 AND 254),
  CONSTRAINT business_crew_members_name_len CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 120)
);

CREATE UNIQUE INDEX IF NOT EXISTS business_crew_members_business_email_uidx
  ON public.business_crew_members (business_id, lower(email));

CREATE INDEX IF NOT EXISTS idx_business_crew_members_owner
  ON public.business_crew_members (owner_id, status);

CREATE INDEX IF NOT EXISTS idx_business_crew_members_user
  ON public.business_crew_members (user_id)
  WHERE user_id IS NOT NULL;

DROP TRIGGER IF EXISTS update_business_crew_members_updated_at ON public.business_crew_members;
CREATE TRIGGER update_business_crew_members_updated_at
  BEFORE UPDATE ON public.business_crew_members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.business_crew_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage business crew" ON public.business_crew_members;
CREATE POLICY "Owners manage business crew"
  ON public.business_crew_members
  FOR ALL
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Crew read own membership" ON public.business_crew_members;
CREATE POLICY "Crew read own membership"
  ON public.business_crew_members
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() AND status = 'active');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_crew_members TO authenticated;
GRANT ALL ON public.business_crew_members TO service_role;

COMMENT ON TABLE public.business_crew_members IS
  'Crew invited by a business owner to use House Pros Hub for maintenance and field work.';

-- ============================================
-- 2. Reusable maintenance service chips (per owner)
-- ============================================
CREATE TABLE IF NOT EXISTS public.pro_crm_maintenance_service_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description_template TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default_seed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pro_crm_maintenance_service_options_name_len CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  CONSTRAINT pro_crm_maintenance_service_options_desc_len CHECK (char_length(description_template) <= 500)
);

CREATE UNIQUE INDEX IF NOT EXISTS pro_crm_maintenance_service_options_owner_name_uidx
  ON public.pro_crm_maintenance_service_options (owner_id, lower(btrim(name)));

CREATE INDEX IF NOT EXISTS idx_pro_crm_maintenance_service_options_owner
  ON public.pro_crm_maintenance_service_options (owner_id, is_active, sort_order);

DROP TRIGGER IF EXISTS update_pro_crm_maintenance_service_options_updated_at ON public.pro_crm_maintenance_service_options;
CREATE TRIGGER update_pro_crm_maintenance_service_options_updated_at
  BEFORE UPDATE ON public.pro_crm_maintenance_service_options
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.pro_crm_maintenance_service_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage maintenance service options" ON public.pro_crm_maintenance_service_options;
CREATE POLICY "Owners manage maintenance service options"
  ON public.pro_crm_maintenance_service_options
  FOR ALL
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pro_crm_maintenance_service_options TO authenticated;
GRANT ALL ON public.pro_crm_maintenance_service_options TO service_role;

-- ============================================
-- 3. Visits
-- ============================================
CREATE TABLE IF NOT EXISTS public.pro_crm_maintenance_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
  customer_id UUID NOT NULL REFERENCES public.pro_crm_customers(id) ON DELETE CASCADE,
  maintenance_plan_id UUID REFERENCES public.pro_crm_maintenance_plans(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.pro_crm_projects(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'cancelled')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  notes TEXT,
  generated_description TEXT,
  responsible_crew_id UUID REFERENCES public.business_crew_members(id) ON DELETE SET NULL,
  responsible_contact_id UUID REFERENCES public.pro_crm_customers(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pro_crm_maintenance_visits_notes_len CHECK (notes IS NULL OR char_length(notes) <= 4000),
  CONSTRAINT pro_crm_maintenance_visits_desc_len CHECK (generated_description IS NULL OR char_length(generated_description) <= 8000)
);

CREATE INDEX IF NOT EXISTS idx_pro_crm_maintenance_visits_owner
  ON public.pro_crm_maintenance_visits (owner_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_pro_crm_maintenance_visits_customer
  ON public.pro_crm_maintenance_visits (customer_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_pro_crm_maintenance_visits_plan
  ON public.pro_crm_maintenance_visits (maintenance_plan_id)
  WHERE maintenance_plan_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pro_crm_maintenance_visits_status
  ON public.pro_crm_maintenance_visits (owner_id, status);

DROP TRIGGER IF EXISTS update_pro_crm_maintenance_visits_updated_at ON public.pro_crm_maintenance_visits;
CREATE TRIGGER update_pro_crm_maintenance_visits_updated_at
  BEFORE UPDATE ON public.pro_crm_maintenance_visits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.pro_crm_maintenance_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage maintenance visits" ON public.pro_crm_maintenance_visits;
CREATE POLICY "Owners manage maintenance visits"
  ON public.pro_crm_maintenance_visits
  FOR ALL
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Crew read assigned visits" ON public.pro_crm_maintenance_visits;
CREATE POLICY "Crew read assigned visits"
  ON public.pro_crm_maintenance_visits
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.business_crew_members crew
      WHERE crew.user_id = auth.uid()
        AND crew.status = 'active'
        AND crew.owner_id = pro_crm_maintenance_visits.owner_id
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pro_crm_maintenance_visits TO authenticated;
GRANT ALL ON public.pro_crm_maintenance_visits TO service_role;

COMMENT ON TABLE public.pro_crm_maintenance_visits IS
  'One on-site maintenance visit with timer, media package, services, notes, and PDF report.';

-- ============================================
-- 4. Services selected on a visit
-- ============================================
CREATE TABLE IF NOT EXISTS public.pro_crm_maintenance_visit_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID NOT NULL REFERENCES public.pro_crm_maintenance_visits(id) ON DELETE CASCADE,
  service_option_id UUID REFERENCES public.pro_crm_maintenance_service_options(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pro_crm_maintenance_visit_services_name_len CHECK (char_length(btrim(name)) BETWEEN 1 AND 80)
);

CREATE INDEX IF NOT EXISTS idx_pro_crm_maintenance_visit_services_visit
  ON public.pro_crm_maintenance_visit_services (visit_id, sort_order);

ALTER TABLE public.pro_crm_maintenance_visit_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage visit services" ON public.pro_crm_maintenance_visit_services;
CREATE POLICY "Owners manage visit services"
  ON public.pro_crm_maintenance_visit_services
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pro_crm_maintenance_visits visit
      WHERE visit.id = visit_id AND visit.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pro_crm_maintenance_visits visit
      WHERE visit.id = visit_id AND visit.owner_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pro_crm_maintenance_visit_services TO authenticated;
GRANT ALL ON public.pro_crm_maintenance_visit_services TO service_role;

-- ============================================
-- 5. Visit media (before / after)
-- ============================================
CREATE TABLE IF NOT EXISTS public.pro_crm_maintenance_visit_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID NOT NULL REFERENCES public.pro_crm_maintenance_visits(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phase TEXT NOT NULL CHECK (phase IN ('before', 'after')),
  kind TEXT NOT NULL CHECK (kind IN ('photo', 'video')),
  drive_file_id UUID NOT NULL REFERENCES public.pro_drive_files(id) ON DELETE CASCADE,
  caption TEXT,
  orientation TEXT CHECK (orientation IS NULL OR orientation IN ('portrait', 'landscape')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pro_crm_maintenance_visit_media_caption_len CHECK (caption IS NULL OR char_length(caption) <= 500)
);

CREATE INDEX IF NOT EXISTS idx_pro_crm_maintenance_visit_media_visit
  ON public.pro_crm_maintenance_visit_media (visit_id, phase, sort_order);

ALTER TABLE public.pro_crm_maintenance_visit_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage visit media" ON public.pro_crm_maintenance_visit_media;
CREATE POLICY "Owners manage visit media"
  ON public.pro_crm_maintenance_visit_media
  FOR ALL
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pro_crm_maintenance_visit_media TO authenticated;
GRANT ALL ON public.pro_crm_maintenance_visit_media TO service_role;

-- ============================================
-- 6. Visit crew assignments
-- ============================================
CREATE TABLE IF NOT EXISTS public.pro_crm_maintenance_visit_crew (
  visit_id UUID NOT NULL REFERENCES public.pro_crm_maintenance_visits(id) ON DELETE CASCADE,
  crew_member_id UUID REFERENCES public.business_crew_members(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.pro_crm_customers(id) ON DELETE CASCADE,
  is_responsible BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pro_crm_maintenance_visit_crew_person CHECK (
    crew_member_id IS NOT NULL OR contact_id IS NOT NULL
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS pro_crm_maintenance_visit_crew_member_uidx
  ON public.pro_crm_maintenance_visit_crew (visit_id, crew_member_id)
  WHERE crew_member_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS pro_crm_maintenance_visit_crew_contact_uidx
  ON public.pro_crm_maintenance_visit_crew (visit_id, contact_id)
  WHERE contact_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS pro_crm_maintenance_visit_crew_one_responsible
  ON public.pro_crm_maintenance_visit_crew (visit_id)
  WHERE is_responsible = true;

ALTER TABLE public.pro_crm_maintenance_visit_crew ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage visit crew" ON public.pro_crm_maintenance_visit_crew;
CREATE POLICY "Owners manage visit crew"
  ON public.pro_crm_maintenance_visit_crew
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pro_crm_maintenance_visits visit
      WHERE visit.id = visit_id AND visit.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pro_crm_maintenance_visits visit
      WHERE visit.id = visit_id AND visit.owner_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pro_crm_maintenance_visit_crew TO authenticated;
GRANT ALL ON public.pro_crm_maintenance_visit_crew TO service_role;

-- ============================================
-- 7. Document kind for maintenance visit reports
-- ============================================
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'pro_crm_customer_documents'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%kind%';
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.pro_crm_customer_documents DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.pro_crm_customer_documents
  ADD CONSTRAINT pro_crm_customer_documents_kind_check
  CHECK (kind IN ('contract', 'project_pdf', 'agreement', 'maintenance_report', 'other'));

ALTER TABLE public.pro_crm_customer_documents
  ADD COLUMN IF NOT EXISTS maintenance_visit_id UUID REFERENCES public.pro_crm_maintenance_visits(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pro_crm_customer_documents_visit
  ON public.pro_crm_customer_documents (maintenance_visit_id)
  WHERE maintenance_visit_id IS NOT NULL;
