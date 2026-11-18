-- One CRM contact per person, with every property the customer linked to that pro.
-- pro_crm_customers.place_id stays as the contact's default property.
-- Estimates and invoices name the property the work is for; NULL means the contact's default.

CREATE TABLE IF NOT EXISTS public.pro_crm_customer_places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.pro_crm_customers(id) ON DELETE CASCADE,
  place_id UUID NOT NULL REFERENCES public.customer_places(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pro_crm_customer_places_unique UNIQUE (customer_id, place_id)
);

CREATE INDEX IF NOT EXISTS idx_pro_crm_customer_places_place
  ON public.pro_crm_customer_places (place_id);
CREATE INDEX IF NOT EXISTS idx_pro_crm_customer_places_owner
  ON public.pro_crm_customer_places (owner_id, customer_id);

ALTER TABLE public.pro_crm_customer_places ENABLE ROW LEVEL SECURITY;

-- Pros read their contacts' properties. Only the service role links one, after the customer
-- shared the place in a chat or approved the pro in My Places.
DROP POLICY IF EXISTS "Contractors read own contact properties" ON public.pro_crm_customer_places;
CREATE POLICY "Contractors read own contact properties"
  ON public.pro_crm_customer_places
  FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

GRANT SELECT ON public.pro_crm_customer_places TO authenticated;
GRANT ALL ON public.pro_crm_customer_places TO service_role;

COMMENT ON TABLE public.pro_crm_customer_places IS
  'Properties (My Places) a customer linked to this pro''s CRM contact. The contact''s place_id is the default one.';

INSERT INTO public.pro_crm_customer_places (owner_id, customer_id, place_id, created_at)
SELECT c.owner_id, c.id, c.place_id, c.created_at
FROM public.pro_crm_customers c
JOIN public.customer_places p ON p.id = c.place_id AND p.user_id = c.portal_user_id
WHERE c.place_id IS NOT NULL
ON CONFLICT (customer_id, place_id) DO NOTHING;

ALTER TABLE public.pro_crm_estimates
  ADD COLUMN IF NOT EXISTS place_id UUID REFERENCES public.customer_places(id) ON DELETE SET NULL;
ALTER TABLE public.pro_crm_invoices
  ADD COLUMN IF NOT EXISTS place_id UUID REFERENCES public.customer_places(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pro_crm_estimates_place
  ON public.pro_crm_estimates (place_id) WHERE place_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pro_crm_invoices_place
  ON public.pro_crm_invoices (place_id) WHERE place_id IS NOT NULL;

COMMENT ON COLUMN public.pro_crm_estimates.place_id IS
  'Property this estimate is for. NULL: the contact''s default property (pro_crm_customers.place_id).';
COMMENT ON COLUMN public.pro_crm_invoices.place_id IS
  'Property this invoice is for. NULL: the contact''s default property (pro_crm_customers.place_id).';
