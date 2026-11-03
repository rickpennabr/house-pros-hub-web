-- Private link so a customer can review, reschedule, or cancel a visit.
-- customer_locale keeps the reminder and manage link in the language they booked with.

ALTER TABLE public.pro_estimate_bookings
  ADD COLUMN IF NOT EXISTS manage_token UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS customer_locale TEXT NOT NULL DEFAULT 'en';

CREATE UNIQUE INDEX IF NOT EXISTS idx_pro_estimate_bookings_manage_token
  ON public.pro_estimate_bookings (manage_token);

DO $$
BEGIN
  ALTER TABLE public.pro_estimate_bookings
    ADD CONSTRAINT pro_estimate_bookings_customer_locale_check
    CHECK (customer_locale IN ('en', 'es', 'pt'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.pro_estimate_bookings.manage_token IS
  'Unguessable link token for the customer manage page. Not a login.';

COMMENT ON COLUMN public.pro_estimate_bookings.customer_locale IS
  'Locale of the booking page, used for the manage link in confirmation and reminder emails.';
