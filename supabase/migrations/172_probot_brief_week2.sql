-- ProBot morning brief, week 2: project cards and per-pro settings.

-- Project cards: a job finishing soon (final invoice), a job starting soon, an accepted estimate
-- with no project yet. A card points at exactly one document.
ALTER TABLE public.probot_followups
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.pro_crm_projects(id) ON DELETE CASCADE;

ALTER TABLE public.probot_followups DROP CONSTRAINT IF EXISTS probot_followups_kind_check;
ALTER TABLE public.probot_followups
  ADD CONSTRAINT probot_followups_kind_check
  CHECK (kind IN ('invoice_unpaid', 'estimate_waiting', 'estimate_accepted', 'project_finishing', 'project_starting'));

ALTER TABLE public.probot_followups DROP CONSTRAINT IF EXISTS probot_followups_check;
ALTER TABLE public.probot_followups DROP CONSTRAINT IF EXISTS probot_followups_one_document;
ALTER TABLE public.probot_followups
  ADD CONSTRAINT probot_followups_one_document
  CHECK (num_nonnulls(invoice_id, estimate_id, project_id) = 1);

-- One live card per document and kind (an estimate can be "waiting" and later "accepted").
DROP INDEX IF EXISTS public.probot_followups_live_invoice;
DROP INDEX IF EXISTS public.probot_followups_live_estimate;
CREATE UNIQUE INDEX IF NOT EXISTS probot_followups_live_invoice
  ON public.probot_followups (invoice_id, kind) WHERE status IN ('open', 'snoozed') AND invoice_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS probot_followups_live_estimate
  ON public.probot_followups (estimate_id, kind) WHERE status IN ('open', 'snoozed') AND estimate_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS probot_followups_live_project
  ON public.probot_followups (project_id, kind) WHERE status IN ('open', 'snoozed') AND project_id IS NOT NULL;

-- Each pro's brief settings. No row = the defaults below.
CREATE TABLE IF NOT EXISTS public.pro_probot_settings (
  owner_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  brief_enabled BOOLEAN NOT NULL DEFAULT true,
  -- Local hour; the brief goes out at :30 of this hour.
  brief_hour SMALLINT NOT NULL DEFAULT 6 CHECK (brief_hour BETWEEN 4 AND 11),
  time_zone TEXT NOT NULL DEFAULT 'America/Los_Angeles' CHECK (char_length(time_zone) BETWEEN 3 AND 64),
  invoice_days SMALLINT NOT NULL DEFAULT 3 CHECK (invoice_days BETWEEN 1 AND 30),
  estimate_days SMALLINT NOT NULL DEFAULT 3 CHECK (estimate_days BETWEEN 1 AND 30),
  project_start_days SMALLINT NOT NULL DEFAULT 2 CHECK (project_start_days BETWEEN 1 AND 14),
  project_cards BOOLEAN NOT NULL DEFAULT true,
  push_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pro_probot_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners manage probot settings" ON public.pro_probot_settings;
CREATE POLICY "Owners manage probot settings"
  ON public.pro_probot_settings
  FOR ALL
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);
