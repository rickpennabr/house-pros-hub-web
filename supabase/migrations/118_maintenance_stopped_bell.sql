-- Let the admin bell show when a customer stops a maintenance service.

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
    'maintenance'
  ));
