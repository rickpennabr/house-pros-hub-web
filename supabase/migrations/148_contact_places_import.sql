-- When a CRM contact's customer has a House Pros Hub account (email claim), the contact's
-- properties move onto the customer's My Places once: the billing address becomes a house and the
-- pro's properties become the customer's. This marks that it ran, so a house the customer later
-- deletes is not put back.

ALTER TABLE public.pro_crm_customers
  ADD COLUMN IF NOT EXISTS places_imported_at TIMESTAMPTZ;

COMMENT ON COLUMN public.pro_crm_customers.places_imported_at IS
  'When this contact''s properties were put on the customer''s My Places. NULL: not yet.';

-- A pro on the house may fix its details (nickname, type, address). The customer and the other
-- pros on the house see who changed what on the house timeline.
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
    'appointment_rescheduled',
    'place_updated'
  ));
