-- ============================================
-- Migration 096: Admin bell covers platform events
-- ============================================
-- Estimates, accepted estimates, bookings, inbound mail, and
-- realtor/installer/business signups need to show in the admin bell.
-- Existing signup and deletion rows stay valid.

-- Inline CHECKs from migration 017 may not use the default constraint name.
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

  FOR constraint_name IN
    SELECT con.conname
    FROM pg_constraint con
    WHERE con.conrelid = 'public.admin_notification_events'::regclass
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%entity_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.admin_notification_events DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE admin_notification_events
  ADD CONSTRAINT admin_notification_events_event_type_check
  CHECK (event_type IN (
    'signup',
    'deletion',
    'estimate',
    'estimate_accepted',
    'booking',
    'incoming_email'
  ));

ALTER TABLE admin_notification_events
  ADD CONSTRAINT admin_notification_events_entity_type_check
  CHECK (entity_type IN (
    'customer',
    'contractor',
    'realtor',
    'installer',
    'business',
    'estimate',
    'booking',
    'email'
  ));

ALTER TABLE admin_notification_events
  ADD COLUMN IF NOT EXISTS detail TEXT;

COMMENT ON TABLE admin_notification_events IS
  'Admin UI: signups, deletions, estimates, bookings, and inbound mail for the notification bell.';
