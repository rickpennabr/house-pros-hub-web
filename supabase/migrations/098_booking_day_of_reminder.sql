-- Morning-of reminder for confirmed ProEstimate appointments.
-- The booking cron sets this once the customer (and pro) email has been sent.

ALTER TABLE public.pro_estimate_bookings
  ADD COLUMN IF NOT EXISTS day_of_reminder_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.pro_estimate_bookings.day_of_reminder_sent_at IS
  'When the morning-of visit reminder was sent. Null until the day-of cron sends it.';

CREATE INDEX IF NOT EXISTS idx_pro_estimate_bookings_day_of_reminder
  ON public.pro_estimate_bookings (slot_start_at)
  WHERE status = 'confirmed' AND day_of_reminder_sent_at IS NULL;
