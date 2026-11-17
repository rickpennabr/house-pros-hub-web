-- Breaks, worker labor hours, maintenance day sessions, and trips between places.

-- ============================================
-- 1. Extend visits for pause / labor
-- ============================================
ALTER TABLE public.pro_crm_maintenance_visits
  DROP CONSTRAINT IF EXISTS pro_crm_maintenance_visits_status_check;

ALTER TABLE public.pro_crm_maintenance_visits
  ADD CONSTRAINT pro_crm_maintenance_visits_status_check
  CHECK (status IN ('in_progress', 'on_break', 'completed', 'cancelled'));

ALTER TABLE public.pro_crm_maintenance_visits
  ADD COLUMN IF NOT EXISTS day_id UUID,
  ADD COLUMN IF NOT EXISTS pause_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS break_seconds INTEGER NOT NULL DEFAULT 0
    CHECK (break_seconds >= 0),
  ADD COLUMN IF NOT EXISTS worker_count INTEGER NOT NULL DEFAULT 1
    CHECK (worker_count >= 1 AND worker_count <= 50),
  ADD COLUMN IF NOT EXISTS labor_seconds INTEGER
    CHECK (labor_seconds IS NULL OR labor_seconds >= 0);

COMMENT ON COLUMN public.pro_crm_maintenance_visits.duration_seconds IS
  'Active on-site seconds (clock time minus breaks).';
COMMENT ON COLUMN public.pro_crm_maintenance_visits.break_seconds IS
  'Total paused break seconds for this visit.';
COMMENT ON COLUMN public.pro_crm_maintenance_visits.worker_count IS
  'People on site for this visit (crew + extras).';
COMMENT ON COLUMN public.pro_crm_maintenance_visits.labor_seconds IS
  'Person-seconds = duration_seconds * worker_count.';

-- ============================================
-- 2. Break audit log
-- ============================================
CREATE TABLE IF NOT EXISTS public.pro_crm_maintenance_visit_breaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID NOT NULL REFERENCES public.pro_crm_maintenance_visits(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pro_crm_maintenance_visit_breaks_visit
  ON public.pro_crm_maintenance_visit_breaks (visit_id, started_at);

ALTER TABLE public.pro_crm_maintenance_visit_breaks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage visit breaks" ON public.pro_crm_maintenance_visit_breaks;
CREATE POLICY "Owners manage visit breaks"
  ON public.pro_crm_maintenance_visit_breaks
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pro_crm_maintenance_visit_breaks TO authenticated;
GRANT ALL ON public.pro_crm_maintenance_visit_breaks TO service_role;

-- ============================================
-- 3. Maintenance work day
-- ============================================
CREATE TABLE IF NOT EXISTS public.pro_crm_maintenance_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
  work_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  total_visit_seconds INTEGER NOT NULL DEFAULT 0 CHECK (total_visit_seconds >= 0),
  total_break_seconds INTEGER NOT NULL DEFAULT 0 CHECK (total_break_seconds >= 0),
  total_trip_seconds INTEGER NOT NULL DEFAULT 0 CHECK (total_trip_seconds >= 0),
  total_labor_seconds INTEGER NOT NULL DEFAULT 0 CHECK (total_labor_seconds >= 0),
  visit_count INTEGER NOT NULL DEFAULT 0 CHECK (visit_count >= 0),
  trip_count INTEGER NOT NULL DEFAULT 0 CHECK (trip_count >= 0),
  max_workers INTEGER NOT NULL DEFAULT 1 CHECK (max_workers >= 1),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pro_crm_maintenance_days_notes_len CHECK (notes IS NULL OR char_length(notes) <= 2000)
);

CREATE UNIQUE INDEX IF NOT EXISTS pro_crm_maintenance_days_one_open
  ON public.pro_crm_maintenance_days (owner_id)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_pro_crm_maintenance_days_owner_date
  ON public.pro_crm_maintenance_days (owner_id, work_date DESC);

DROP TRIGGER IF EXISTS update_pro_crm_maintenance_days_updated_at ON public.pro_crm_maintenance_days;
CREATE TRIGGER update_pro_crm_maintenance_days_updated_at
  BEFORE UPDATE ON public.pro_crm_maintenance_days
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.pro_crm_maintenance_days ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage maintenance days" ON public.pro_crm_maintenance_days;
CREATE POLICY "Owners manage maintenance days"
  ON public.pro_crm_maintenance_days
  FOR ALL
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pro_crm_maintenance_days TO authenticated;
GRANT ALL ON public.pro_crm_maintenance_days TO service_role;

ALTER TABLE public.pro_crm_maintenance_visits
  DROP CONSTRAINT IF EXISTS pro_crm_maintenance_visits_day_id_fkey;

ALTER TABLE public.pro_crm_maintenance_visits
  ADD CONSTRAINT pro_crm_maintenance_visits_day_id_fkey
  FOREIGN KEY (day_id) REFERENCES public.pro_crm_maintenance_days(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pro_crm_maintenance_visits_day
  ON public.pro_crm_maintenance_visits (day_id)
  WHERE day_id IS NOT NULL;

-- ============================================
-- 4. Trips between maintenance places
-- ============================================
CREATE TABLE IF NOT EXISTS public.pro_crm_maintenance_day_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id UUID NOT NULL REFERENCES public.pro_crm_maintenance_days(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_visit_id UUID REFERENCES public.pro_crm_maintenance_visits(id) ON DELETE SET NULL,
  to_visit_id UUID REFERENCES public.pro_crm_maintenance_visits(id) ON DELETE SET NULL,
  from_customer_id UUID REFERENCES public.pro_crm_customers(id) ON DELETE SET NULL,
  to_customer_id UUID REFERENCES public.pro_crm_customers(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  miles NUMERIC(8, 2) CHECK (miles IS NULL OR miles >= 0),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pro_crm_maintenance_day_trips_note_len CHECK (note IS NULL OR char_length(note) <= 500)
);

CREATE INDEX IF NOT EXISTS idx_pro_crm_maintenance_day_trips_day
  ON public.pro_crm_maintenance_day_trips (day_id, started_at);

CREATE UNIQUE INDEX IF NOT EXISTS pro_crm_maintenance_day_trips_one_open
  ON public.pro_crm_maintenance_day_trips (day_id)
  WHERE ended_at IS NULL;

ALTER TABLE public.pro_crm_maintenance_day_trips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage maintenance day trips" ON public.pro_crm_maintenance_day_trips;
CREATE POLICY "Owners manage maintenance day trips"
  ON public.pro_crm_maintenance_day_trips
  FOR ALL
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pro_crm_maintenance_day_trips TO authenticated;
GRANT ALL ON public.pro_crm_maintenance_day_trips TO service_role;
