-- Repeating busy times on the pro calendar (e.g. every Monday and Tuesday 2:30-4:30 PM,
-- or every other Friday). Customers cannot book a slot that overlaps one.
-- Times are wall-clock in the business timezone, so they stay put across daylight saving.
CREATE TABLE IF NOT EXISTS public.pro_recurring_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- 0 = Monday ... 6 = Sunday (same order as DAY_KEYS in lib/booking/businessHours.ts).
  weekdays SMALLINT[] NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  -- 1 = every week, 2 = every other week, ...
  every_weeks SMALLINT NOT NULL DEFAULT 1,
  -- First day it applies. Also the anchor week for every-N-weeks.
  starts_on DATE NOT NULL DEFAULT CURRENT_DATE,
  ends_on DATE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pro_recurring_blocks_weekdays CHECK (
    cardinality(weekdays) BETWEEN 1 AND 7 AND weekdays <@ ARRAY[0,1,2,3,4,5,6]::SMALLINT[]
  ),
  CONSTRAINT pro_recurring_blocks_times CHECK (
    start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    AND end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    AND end_time > start_time
  ),
  CONSTRAINT pro_recurring_blocks_every CHECK (every_weeks BETWEEN 1 AND 8),
  CONSTRAINT pro_recurring_blocks_range CHECK (ends_on IS NULL OR ends_on >= starts_on)
);

CREATE INDEX IF NOT EXISTS idx_pro_recurring_blocks_owner_id ON public.pro_recurring_blocks(owner_id);

CREATE TRIGGER update_pro_recurring_blocks_updated_at
  BEFORE UPDATE ON public.pro_recurring_blocks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.pro_recurring_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pros manage own recurring blocks"
  ON public.pro_recurring_blocks
  FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

COMMENT ON TABLE public.pro_recurring_blocks IS 'Repeating busy times on the pro calendar; booking slots skip them.';
