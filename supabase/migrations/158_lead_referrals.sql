-- Lead referrals: the admin assigns a site estimate request (public.estimates) to one pro.
-- The pro gets an email and a ProBot card (which also lights their bell). The customer's
-- name, phone and email stay hidden until the pro taps "Add to my CRM".
-- One open offer per request; assigning another pro cancels it. An offer nobody answers expires
-- after 48 hours (/api/cron/lead-expiry). Server (service role) only.

CREATE TABLE IF NOT EXISTS public.lead_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'offered' CHECK (status IN ('offered', 'accepted', 'declined', 'cancelled', 'expired')),
  message_id UUID REFERENCES public.probot_messages(id) ON DELETE SET NULL,
  crm_customer_id UUID REFERENCES public.pro_crm_customers(id) ON DELETE SET NULL,
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '48 hours'),
  responded_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS lead_referrals_one_open ON public.lead_referrals (estimate_id) WHERE status = 'offered';
CREATE INDEX IF NOT EXISTS lead_referrals_estimate ON public.lead_referrals (estimate_id, created_at DESC);
CREATE INDEX IF NOT EXISTS lead_referrals_open_expiry ON public.lead_referrals (expires_at) WHERE status = 'offered';
CREATE INDEX IF NOT EXISTS lead_referrals_owner ON public.lead_referrals (owner_id, created_at DESC);

-- No policies: only the service role (API routes) reads or writes referrals.
ALTER TABLE public.lead_referrals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lead_referrals FROM anon, authenticated;

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
