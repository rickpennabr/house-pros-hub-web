-- My Places timeline + optional job area on estimates (pavers, landscape, kitchen, …).
-- Multiple pros can send work for different areas; all land under the same customer_places row
-- via pro_crm_customers.place_id. Timeline events record entered / received / approved / paid.

ALTER TABLE public.pro_crm_estimates
  ADD COLUMN IF NOT EXISTS job_area TEXT;

COMMENT ON COLUMN public.pro_crm_estimates.job_area IS
  'Optional area of the property this estimate covers (e.g. Pavers, Landscape, Kitchen). Shown on My Places.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pro_crm_estimates_job_area_len'
  ) THEN
    ALTER TABLE public.pro_crm_estimates
      ADD CONSTRAINT pro_crm_estimates_job_area_len
      CHECK (job_area IS NULL OR char_length(btrim(job_area)) BETWEEN 1 AND 80);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.customer_place_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id UUID NOT NULL REFERENCES public.customer_places(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN (
    'place_entered',
    'pro_linked',
    'estimate_received',
    'estimate_approved',
    'estimate_declined',
    'invoice_received',
    'invoice_paid',
    'document_received',
    'project_shared',
    'maintenance_started',
    'maintenance_stopped'
  )),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  title TEXT NOT NULL,
  detail TEXT,
  pro_name TEXT,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.pro_crm_customers(id) ON DELETE SET NULL,
  estimate_id UUID REFERENCES public.pro_crm_estimates(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES public.pro_crm_invoices(id) ON DELETE SET NULL,
  document_id UUID REFERENCES public.pro_crm_customer_documents(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.pro_crm_projects(id) ON DELETE SET NULL,
  job_area TEXT,
  amount_cents INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT customer_place_events_title_len CHECK (char_length(title) BETWEEN 1 AND 200)
);

CREATE INDEX IF NOT EXISTS idx_customer_place_events_place_time
  ON public.customer_place_events (place_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_place_events_estimate
  ON public.customer_place_events (estimate_id)
  WHERE estimate_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customer_place_events_invoice
  ON public.customer_place_events (invoice_id)
  WHERE invoice_id IS NOT NULL;

-- Idempotent sync: one event per place+kind+document ref
CREATE UNIQUE INDEX IF NOT EXISTS uq_place_event_entered
  ON public.customer_place_events (place_id)
  WHERE kind = 'place_entered';

CREATE UNIQUE INDEX IF NOT EXISTS uq_place_event_estimate_kind
  ON public.customer_place_events (place_id, estimate_id, kind)
  WHERE estimate_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_place_event_invoice_kind
  ON public.customer_place_events (place_id, invoice_id, kind)
  WHERE invoice_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_place_event_document_kind
  ON public.customer_place_events (place_id, document_id, kind)
  WHERE document_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_place_event_pro_linked
  ON public.customer_place_events (place_id, customer_id, kind)
  WHERE kind = 'pro_linked' AND customer_id IS NOT NULL;

ALTER TABLE public.customer_place_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read place events" ON public.customer_place_events;
CREATE POLICY "Users read place events"
  ON public.customer_place_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.customer_places p
      WHERE p.id = customer_place_events.place_id
        AND p.user_id = auth.uid()
    )
  );

GRANT SELECT ON public.customer_place_events TO authenticated;
GRANT ALL ON public.customer_place_events TO service_role;

COMMENT ON TABLE public.customer_place_events IS
  'Chronological history for a My Place: when the property was entered, when each pro sent or got approval on estimates/invoices/documents.';

-- Seed place_entered from existing places
INSERT INTO public.customer_place_events (place_id, kind, occurred_at, title, detail)
SELECT
  p.id,
  'place_entered',
  p.created_at,
  'Place added',
  COALESCE(NULLIF(btrim(p.name), ''), 'My place')
FROM public.customer_places p
WHERE NOT EXISTS (
  SELECT 1
  FROM public.customer_place_events e
  WHERE e.place_id = p.id
    AND e.kind = 'place_entered'
);
