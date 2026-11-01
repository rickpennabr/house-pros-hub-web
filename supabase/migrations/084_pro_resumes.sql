-- One ProResume per installer, and Easy Apply snapshots on ProJobs.
-- Installers own the résumé. The contractor who posted a job can read applications for that job.

CREATE TABLE IF NOT EXISTS public.pro_resumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  headline text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  state text NOT NULL DEFAULT '',
  summary text NOT NULL DEFAULT '',
  skills jsonb NOT NULL DEFAULT '[]'::jsonb,
  experience jsonb NOT NULL DEFAULT '[]'::jsonb,
  education jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pro_resumes_full_name_len CHECK (char_length(full_name) <= 120),
  CONSTRAINT pro_resumes_headline_len CHECK (char_length(headline) <= 160),
  CONSTRAINT pro_resumes_summary_len CHECK (char_length(summary) <= 2000),
  CONSTRAINT pro_resumes_state_len CHECK (state = '' OR char_length(state) = 2)
);

CREATE TABLE IF NOT EXISTS public.pro_job_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.pro_jobs(id) ON DELETE CASCADE,
  installer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pro_job_applications_job_installer_key UNIQUE (job_id, installer_id)
);

CREATE INDEX IF NOT EXISTS pro_job_applications_job_id_idx
  ON public.pro_job_applications (job_id, created_at DESC);

ALTER TABLE public.pro_resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pro_job_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Installers manage their ProResume" ON public.pro_resumes;
CREATE POLICY "Installers manage their ProResume"
  ON public.pro_resumes
  FOR ALL
  TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'installer'
        AND ur.is_active = true
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'installer'
        AND ur.is_active = true
    )
  );

DROP POLICY IF EXISTS "Installers apply with their ProResume" ON public.pro_job_applications;
CREATE POLICY "Installers apply with their ProResume"
  ON public.pro_job_applications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    installer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'installer'
        AND ur.is_active = true
    )
    AND EXISTS (
      SELECT 1 FROM public.pro_resumes r
      WHERE r.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.pro_jobs j
      WHERE j.id = job_id
    )
  );

DROP POLICY IF EXISTS "Installers and hiring contractors read applications" ON public.pro_job_applications;
CREATE POLICY "Installers and hiring contractors read applications"
  ON public.pro_job_applications
  FOR SELECT
  TO authenticated
  USING (
    installer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.pro_jobs j
      WHERE j.id = pro_job_applications.job_id
        AND j.owner_id = auth.uid()
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.pro_resumes TO authenticated;
GRANT SELECT, INSERT ON public.pro_job_applications TO authenticated;
GRANT ALL ON public.pro_resumes TO service_role;
GRANT ALL ON public.pro_job_applications TO service_role;

DROP TRIGGER IF EXISTS update_pro_resumes_updated_at ON public.pro_resumes;
CREATE TRIGGER update_pro_resumes_updated_at
  BEFORE UPDATE ON public.pro_resumes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.pro_resumes IS
  'One ProResume per installer. Built in the editor, filled from an upload, or drafted with the assistant.';
COMMENT ON TABLE public.pro_job_applications IS
  'Easy Apply snapshot. Installers submit their saved ProResume. The contractor who posted the job can read it.';
