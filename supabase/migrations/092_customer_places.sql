-- Customer places: the house, business, or building a person uses.
-- A contractor publishes projects, maintenance, and documents onto the CRM customer.
-- When that customer's email matches a confirmed House Pros Hub login, the place shows up for them.

CREATE TABLE IF NOT EXISTS public.customer_places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'house' CHECK (kind IN ('house', 'business', 'building')),
  name TEXT NOT NULL,
  street TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT customer_places_name_len CHECK (char_length(name) BETWEEN 1 AND 120)
);

CREATE INDEX IF NOT EXISTS idx_customer_places_user ON public.customer_places (user_id, created_at DESC);

DROP TRIGGER IF EXISTS update_customer_places_updated_at ON public.customer_places;
CREATE TRIGGER update_customer_places_updated_at
  BEFORE UPDATE ON public.customer_places
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.customer_places ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their places" ON public.customer_places;
CREATE POLICY "Users manage their places"
  ON public.customer_places
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_places TO authenticated;
GRANT ALL ON public.customer_places TO service_role;

COMMENT ON TABLE public.customer_places IS
  'A house, business, or building the signed-in customer uses. Work from a contractor is attached through the CRM customer.';

ALTER TABLE public.pro_crm_customers
  ADD COLUMN IF NOT EXISTS portal_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS place_id UUID REFERENCES public.customer_places(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS portal_kind TEXT CHECK (portal_kind IS NULL OR portal_kind IN ('house', 'business', 'building'));

CREATE INDEX IF NOT EXISTS idx_pro_crm_customers_portal_user
  ON public.pro_crm_customers (portal_user_id)
  WHERE portal_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pro_crm_customers_place
  ON public.pro_crm_customers (place_id)
  WHERE place_id IS NOT NULL;

COMMENT ON COLUMN public.pro_crm_customers.portal_user_id IS
  'House Pros Hub user who may read this customer''s shared projects, maintenance, and documents. Set by email claim or the service role.';
COMMENT ON COLUMN public.pro_crm_customers.place_id IS
  'Customer place this work belongs to.';
COMMENT ON COLUMN public.pro_crm_customers.portal_kind IS
  'How this address should appear for the customer: house, business, or building.';

-- Contractors can edit the row, but only the service role may attach a login.
CREATE OR REPLACE FUNCTION public.protect_portal_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
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
    NEW.portal_user_id := NULL;
    NEW.place_id := NULL;
    RETURN NEW;
  END IF;
  NEW.portal_user_id := OLD.portal_user_id;
  NEW.place_id := OLD.place_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pro_crm_customers_protect_portal_user ON public.pro_crm_customers;
CREATE TRIGGER pro_crm_customers_protect_portal_user
  BEFORE INSERT OR UPDATE ON public.pro_crm_customers
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_portal_user_id();

ALTER TABLE public.pro_crm_projects
  ADD COLUMN IF NOT EXISTS shared BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.pro_crm_projects.shared IS
  'When true, the linked customer can see this project on their place. Office notes stay off that view.';

CREATE TABLE IF NOT EXISTS public.pro_crm_project_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.pro_crm_projects(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'done')),
  start_date DATE,
  end_date DATE,
  customer_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pro_crm_project_phases_name_len CHECK (char_length(name) BETWEEN 1 AND 120),
  CONSTRAINT pro_crm_project_phases_note_len CHECK (customer_note IS NULL OR char_length(customer_note) <= 500)
);

CREATE INDEX IF NOT EXISTS idx_pro_crm_project_phases_project
  ON public.pro_crm_project_phases (project_id, sort_order, created_at);

DROP TRIGGER IF EXISTS update_pro_crm_project_phases_updated_at ON public.pro_crm_project_phases;
CREATE TRIGGER update_pro_crm_project_phases_updated_at
  BEFORE UPDATE ON public.pro_crm_project_phases
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.pro_crm_project_phases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Contractors manage own project phases" ON public.pro_crm_project_phases;
CREATE POLICY "Contractors manage own project phases"
  ON public.pro_crm_project_phases
  FOR ALL
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pro_crm_project_phases TO authenticated;
GRANT ALL ON public.pro_crm_project_phases TO service_role;

COMMENT ON TABLE public.pro_crm_project_phases IS
  'The plan the customer sees: ordered steps with dates. customer_note is the only note published.';

CREATE TABLE IF NOT EXISTS public.pro_crm_maintenance_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.pro_crm_customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  summary TEXT,
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
  next_visit_date DATE,
  last_visit_date DATE,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  amount_cents INTEGER CHECK (amount_cents IS NULL OR amount_cents >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pro_crm_maintenance_plans_name_len CHECK (char_length(name) BETWEEN 1 AND 120),
  CONSTRAINT pro_crm_maintenance_plans_summary_len CHECK (summary IS NULL OR char_length(summary) <= 1000)
);

CREATE INDEX IF NOT EXISTS idx_pro_crm_maintenance_plans_customer
  ON public.pro_crm_maintenance_plans (customer_id, is_active, next_visit_date);

DROP TRIGGER IF EXISTS update_pro_crm_maintenance_plans_updated_at ON public.pro_crm_maintenance_plans;
CREATE TRIGGER update_pro_crm_maintenance_plans_updated_at
  BEFORE UPDATE ON public.pro_crm_maintenance_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.pro_crm_maintenance_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Contractors manage own maintenance plans" ON public.pro_crm_maintenance_plans;
CREATE POLICY "Contractors manage own maintenance plans"
  ON public.pro_crm_maintenance_plans
  FOR ALL
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pro_crm_maintenance_plans TO authenticated;
GRANT ALL ON public.pro_crm_maintenance_plans TO service_role;

COMMENT ON TABLE public.pro_crm_maintenance_plans IS
  'Repeating service on a customer place: weekly, biweekly, monthly, quarterly, or yearly.';

CREATE TABLE IF NOT EXISTS public.pro_crm_customer_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.pro_crm_customers(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.pro_crm_projects(id) ON DELETE SET NULL,
  maintenance_plan_id UUID REFERENCES public.pro_crm_maintenance_plans(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('contract', 'project_pdf', 'agreement', 'other')),
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL CHECK (file_size_bytes > 0),
  content_type TEXT NOT NULL,
  visible_to_customer BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pro_crm_customer_documents_title_len CHECK (char_length(title) BETWEEN 1 AND 160)
);

CREATE INDEX IF NOT EXISTS idx_pro_crm_customer_documents_customer
  ON public.pro_crm_customer_documents (customer_id, created_at DESC);

ALTER TABLE public.pro_crm_customer_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Contractors manage own customer documents" ON public.pro_crm_customer_documents;
CREATE POLICY "Contractors manage own customer documents"
  ON public.pro_crm_customer_documents
  FOR ALL
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pro_crm_customer_documents TO authenticated;
GRANT ALL ON public.pro_crm_customer_documents TO service_role;

COMMENT ON TABLE public.pro_crm_customer_documents IS
  'Contract, project PDF, or maintenance agreement published to the customer place. Bytes live in customer-documents.';

INSERT INTO storage.buckets (id, name, public)
VALUES ('customer-documents', 'customer-documents', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Contractors upload customer documents" ON storage.objects;
CREATE POLICY "Contractors upload customer documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'customer-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Contractors read customer documents" ON storage.objects;
CREATE POLICY "Contractors read customer documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'customer-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Contractors delete customer documents" ON storage.objects;
CREATE POLICY "Contractors delete customer documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'customer-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
