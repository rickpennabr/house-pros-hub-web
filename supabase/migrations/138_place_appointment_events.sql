-- My Places timeline: appointments (public bookings + CRM tasks on a customer).

ALTER TABLE public.customer_place_events
  DROP CONSTRAINT IF EXISTS customer_place_events_kind_check;

ALTER TABLE public.customer_place_events
  ADD CONSTRAINT customer_place_events_kind_check
  CHECK (kind IN (
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
    'maintenance_stopped',
    'appointment_booked',
    'appointment_cancelled',
    'appointment_completed',
    'appointment_rescheduled'
  ));

ALTER TABLE public.customer_place_events
  ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES public.pro_estimate_bookings(id) ON DELETE SET NULL;

ALTER TABLE public.customer_place_events
  ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES public.pro_crm_tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customer_place_events_booking
  ON public.customer_place_events (booking_id)
  WHERE booking_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customer_place_events_task
  ON public.customer_place_events (task_id)
  WHERE task_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_place_event_booking_kind
  ON public.customer_place_events (place_id, booking_id, kind)
  WHERE booking_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_place_event_task_kind
  ON public.customer_place_events (place_id, task_id, kind)
  WHERE task_id IS NOT NULL;

COMMENT ON COLUMN public.customer_place_events.booking_id IS
  'Public appointment booking (pro_estimate_bookings) linked to this timeline row.';

COMMENT ON COLUMN public.customer_place_events.task_id IS
  'CRM calendar task (pro_crm_tasks) linked to this timeline row.';
