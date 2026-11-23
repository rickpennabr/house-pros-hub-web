-- Travel / buffer time the pro needs between two customer appointments (minutes).
-- Booking slots keep this gap after and before every booked appointment.
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS appointment_buffer_minutes SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE public.businesses DROP CONSTRAINT IF EXISTS businesses_appointment_buffer_minutes_range;
ALTER TABLE public.businesses ADD CONSTRAINT businesses_appointment_buffer_minutes_range
  CHECK (appointment_buffer_minutes BETWEEN 0 AND 240);
COMMENT ON COLUMN public.businesses.appointment_buffer_minutes IS 'Minutes kept free before and after each booked appointment (travel time).';
