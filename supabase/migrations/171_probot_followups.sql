-- ProBot morning brief and follow-up cards for pros.
-- Each morning ProBot posts a brief and one card per item that needs the pro (an unpaid invoice,
-- an unanswered estimate). A card only goes to a customer after the pro taps Send.
-- One open card per document at a time; after the pro acts, the next card waits 7 days.

CREATE TABLE IF NOT EXISTS public.probot_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('invoice_unpaid', 'estimate_waiting')),
  invoice_id UUID REFERENCES public.pro_crm_invoices(id) ON DELETE CASCADE,
  estimate_id UUID REFERENCES public.pro_crm_estimates(id) ON DELETE CASCADE,
  -- open: card waiting; snoozed: hidden until snoozed_until; sent: pro sent the reminder/follow-up;
  -- done: handled another way (paid, accepted, dismissed).
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'snoozed', 'sent', 'done')),
  snoozed_until DATE,
  message_id UUID REFERENCES public.probot_messages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acted_at TIMESTAMPTZ,
  CHECK ((invoice_id IS NOT NULL) <> (estimate_id IS NOT NULL))
);

-- At most one live card (open or snoozed) per document.
CREATE UNIQUE INDEX IF NOT EXISTS probot_followups_live_invoice
  ON public.probot_followups (invoice_id) WHERE status IN ('open', 'snoozed') AND invoice_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS probot_followups_live_estimate
  ON public.probot_followups (estimate_id) WHERE status IN ('open', 'snoozed') AND estimate_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS probot_followups_owner ON public.probot_followups (owner_id, status, created_at DESC);

ALTER TABLE public.probot_followups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners read probot followups" ON public.probot_followups;
CREATE POLICY "Owners read probot followups"
  ON public.probot_followups
  FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

-- One morning brief per pro per local day.
CREATE TABLE IF NOT EXISTS public.probot_morning_runs (
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  run_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (owner_id, run_date)
);
ALTER TABLE public.probot_morning_runs ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.probot_followups IS
  'ProBot follow-up cards for pros (unpaid invoices, unanswered estimates). Written by the server; the pro acts from the card.';
