-- Brings lead_referrals up to date where an early copy of 158 ran (no 48-hour expiry).
-- Safe to run more than once, and safe where the full 158 already ran.

ALTER TABLE public.lead_referrals
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '48 hours');

-- Offers sent before this column existed get 48 hours from when they were sent.
UPDATE public.lead_referrals
SET expires_at = created_at + interval '48 hours'
WHERE status = 'offered' AND expires_at > created_at + interval '48 hours';

-- Status: add 'expired'.
DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT con.conname
    FROM pg_constraint con
    WHERE con.conrelid = 'public.lead_referrals'::regclass
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.lead_referrals DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE public.lead_referrals
  ADD CONSTRAINT lead_referrals_status_check
  CHECK (status IN ('offered', 'accepted', 'declined', 'cancelled', 'expired'));

CREATE INDEX IF NOT EXISTS lead_referrals_open_expiry ON public.lead_referrals (expires_at) WHERE status = 'offered';

-- Admin bell: a pro added, declined, or never answered a job request.
DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT con.conname
    FROM pg_constraint con
    WHERE con.conrelid = 'public.admin_notification_events'::regclass
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%event_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.admin_notification_events DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE public.admin_notification_events
  ADD CONSTRAINT admin_notification_events_event_type_check
  CHECK (event_type IN (
    'signup',
    'deletion',
    'estimate',
    'estimate_accepted',
    'booking',
    'incoming_email',
    'maintenance',
    'lead_accepted',
    'lead_declined',
    'lead_expired'
  ));
