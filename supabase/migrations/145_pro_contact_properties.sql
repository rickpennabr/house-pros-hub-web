-- Pros add properties to a CRM contact themselves (nickname, type, address), like My Places.
-- They live in customer_places with no customer account (user_id NULL) and the pro as owner_id,
-- linked to the contact through pro_crm_customer_places, so estimates, invoices and maintenance
-- agreements point at them with the same place_id. They never show on anyone's My Places.

ALTER TABLE public.customer_places
  ALTER COLUMN user_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'customer_places_user_or_owner'
  ) THEN
    ALTER TABLE public.customer_places
      ADD CONSTRAINT customer_places_user_or_owner
        CHECK (user_id IS NOT NULL OR owner_id IS NOT NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_customer_places_owner
  ON public.customer_places (owner_id)
  WHERE owner_id IS NOT NULL;

-- Pros read the properties they added. Writes go through the service role (CRM API).
DROP POLICY IF EXISTS "Pros read properties they added" ON public.customer_places;
CREATE POLICY "Pros read properties they added"
  ON public.customer_places
  FOR SELECT
  TO authenticated
  USING (user_id IS NULL AND owner_id = auth.uid());

COMMENT ON COLUMN public.customer_places.user_id IS
  'Customer whose My Places this is. NULL: a property a pro added to a CRM contact (see owner_id).';
COMMENT ON COLUMN public.customer_places.owner_id IS
  'Pro who added this property to a CRM contact. Set only when user_id is NULL.';

-- The contact's own (billing) address is a property too: the default when the customer has not
-- shared a My Places house. place_id NULL on an estimate, invoice or agreement means this one.
ALTER TABLE public.pro_crm_customers
  ADD COLUMN IF NOT EXISTS address_nickname TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pro_crm_customers_address_nickname_len'
  ) THEN
    ALTER TABLE public.pro_crm_customers
      ADD CONSTRAINT pro_crm_customers_address_nickname_len
        CHECK (address_nickname IS NULL OR char_length(address_nickname) <= 120);
  END IF;
END $$;

COMMENT ON COLUMN public.pro_crm_customers.address_nickname IS
  'Nickname for the contact''s own address (e.g. Main house), shown with their other properties.';
