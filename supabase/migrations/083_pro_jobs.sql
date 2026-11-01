-- ProJobs: public job board. Only an active contractor can post, and only for a
-- business they own. Customers, realtors, and installers cannot insert rows.

CREATE TABLE IF NOT EXISTS public.pro_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  employment_type text NOT NULL,
  workplace_type text NOT NULL,
  workplace_language text NOT NULL,
  city text NOT NULL,
  state text NOT NULL,
  pay text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pro_jobs_title_len CHECK (char_length(title) BETWEEN 1 AND 120),
  CONSTRAINT pro_jobs_description_len CHECK (char_length(description) BETWEEN 10 AND 4000),
  CONSTRAINT pro_jobs_city_len CHECK (char_length(city) BETWEEN 1 AND 80),
  CONSTRAINT pro_jobs_state_len CHECK (char_length(state) = 2),
  CONSTRAINT pro_jobs_pay_len CHECK (pay IS NULL OR char_length(pay) BETWEEN 1 AND 40),
  CONSTRAINT pro_jobs_employment_type_check CHECK (
    employment_type IN ('full_time', 'part_time', 'contract', 'hourly')
  ),
  CONSTRAINT pro_jobs_workplace_type_check CHECK (
    workplace_type IN ('on_site', 'hybrid')
  ),
  CONSTRAINT pro_jobs_workplace_language_check CHECK (
    workplace_language IN ('en', 'es', 'bilingual')
  ),
  CONSTRAINT pro_jobs_category_check CHECK (
    category IN (
      'General Contractor',
      'Handyman',
      'Landscape',
      'Pavers',
      'Concrete',
      'Tile',
      'Masonry',
      'Roofing',
      'Siding',
      'Gutters',
      'Garage Doors',
      'Plumbing',
      'Electrical',
      'Smart Home',
      'HVAC',
      'Painting',
      'Flooring',
      'Carpet',
      'Glass',
      'Windows',
      'Doors',
      'Windows & Doors',
      'Patio Cover',
      'Custom Outdoor Living',
      'Fencing',
      'Ornamental Iron',
      'Decking',
      'Carpentry',
      'Pools & Spas',
      'Solar',
      'Fire Protection'
    )
  )
);

CREATE INDEX IF NOT EXISTS pro_jobs_created_at_idx ON public.pro_jobs (created_at DESC);
CREATE INDEX IF NOT EXISTS pro_jobs_owner_id_idx ON public.pro_jobs (owner_id);
CREATE INDEX IF NOT EXISTS pro_jobs_business_id_idx ON public.pro_jobs (business_id);
CREATE INDEX IF NOT EXISTS pro_jobs_category_idx ON public.pro_jobs (category);

ALTER TABLE public.pro_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view jobs for active businesses" ON public.pro_jobs;
CREATE POLICY "Anyone can view jobs for active businesses"
  ON public.pro_jobs
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.businesses b
      WHERE b.id = pro_jobs.business_id
        AND b.is_active = true
    )
  );

DROP POLICY IF EXISTS "Contractors insert jobs for their business" ON public.pro_jobs;
CREATE POLICY "Contractors insert jobs for their business"
  ON public.pro_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.businesses b
      WHERE b.id = business_id
        AND b.owner_id = auth.uid()
        AND b.is_active = true
    )
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'contractor'
        AND ur.is_active = true
    )
  );

DROP POLICY IF EXISTS "Contractors update their jobs" ON public.pro_jobs;
CREATE POLICY "Contractors update their jobs"
  ON public.pro_jobs
  FOR UPDATE
  TO authenticated
  USING (
    owner_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'contractor'
        AND ur.is_active = true
    )
  )
  WITH CHECK (
    owner_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.businesses b
      WHERE b.id = business_id
        AND b.owner_id = auth.uid()
        AND b.is_active = true
    )
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'contractor'
        AND ur.is_active = true
    )
  );

DROP POLICY IF EXISTS "Contractors delete their jobs" ON public.pro_jobs;
CREATE POLICY "Contractors delete their jobs"
  ON public.pro_jobs
  FOR DELETE
  TO authenticated
  USING (
    owner_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'contractor'
        AND ur.is_active = true
    )
  );

GRANT SELECT ON public.pro_jobs TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.pro_jobs TO authenticated;
GRANT ALL ON public.pro_jobs TO service_role;

DROP TRIGGER IF EXISTS update_pro_jobs_updated_at ON public.pro_jobs;
CREATE TRIGGER update_pro_jobs_updated_at
  BEFORE UPDATE ON public.pro_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.pro_jobs IS
  'ProJobs board. Public read for active businesses. Writes require an active contractor role and ownership of the business.';
