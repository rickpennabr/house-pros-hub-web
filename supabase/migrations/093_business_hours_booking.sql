-- Appointment length for contractor and realtor booking.
-- Weekly hours stay in businesses.operating_hours:
--   { "monday": { "open": true, "start": "08:00", "end": "17:00" }, ... }
-- Times are wall-clock in businesses.timezone.
-- show_calendar_on_procard remains the ProsCRM switch for customer appointments.

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS appointment_slot_minutes INTEGER NOT NULL DEFAULT 90;

DO $$
BEGIN
  ALTER TABLE public.businesses
    ADD CONSTRAINT businesses_appointment_slot_minutes_check
    CHECK (appointment_slot_minutes IN (30, 45, 60, 90, 120));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.businesses.operating_hours IS
  'Weekly hours JSON keyed by monday..sunday: { open, start, end } as HH:mm in businesses.timezone.';

COMMENT ON COLUMN public.businesses.appointment_slot_minutes IS
  'Length of one customer appointment slot, in minutes.';

COMMENT ON COLUMN public.businesses.show_calendar_on_procard IS
  'When true, customers can book an appointment with this pro (ProCard, services, /book). Separate from the hub free estimate.';
