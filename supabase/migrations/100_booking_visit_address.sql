-- Where the pro is going, plus a calendar sequence so invite updates replace the same event.

ALTER TABLE public.pro_estimate_bookings
  ADD COLUMN IF NOT EXISTS visit_street TEXT,
  ADD COLUMN IF NOT EXISTS visit_city TEXT,
  ADD COLUMN IF NOT EXISTS visit_state TEXT,
  ADD COLUMN IF NOT EXISTS visit_zip TEXT,
  ADD COLUMN IF NOT EXISTS visit_note TEXT,
  ADD COLUMN IF NOT EXISTS ics_sequence INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.pro_estimate_bookings.visit_street IS
  'Street where the pro should arrive for this visit.';
COMMENT ON COLUMN public.pro_estimate_bookings.visit_note IS
  'Optional customer note: gate code, parking, what to look at.';
COMMENT ON COLUMN public.pro_estimate_bookings.ics_sequence IS
  'Increments when the visit is rescheduled or cancelled so calendar apps replace the invite.';
