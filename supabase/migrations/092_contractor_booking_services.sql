-- Public service catalog for contractor bookings.
-- Customers pick one of these when they book a ProEstimate. Names also stay on businesses.services for search.

CREATE TABLE IF NOT EXISTS public.pro_booking_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  price_cents INTEGER NOT NULL DEFAULT 0,
  price_max_cents INTEGER,
  price_type TEXT NOT NULL DEFAULT 'fixed' CHECK (price_type IN ('fixed', 'starting_at', 'range')),
  unit TEXT NOT NULL DEFAULT 'job' CHECK (unit IN ('job', 'hour', 'sqft', 'each')),
  image_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pro_booking_services_name_len CHECK (char_length(btrim(name)) BETWEEN 2 AND 80),
  CONSTRAINT pro_booking_services_description_len CHECK (char_length(description) <= 200),
  CONSTRAINT pro_booking_services_category_len CHECK (char_length(category) <= 80),
  CONSTRAINT pro_booking_services_price_nonneg CHECK (price_cents >= 0 AND (price_max_cents IS NULL OR price_max_cents >= 0)),
  CONSTRAINT pro_booking_services_range_max CHECK (
    price_type <> 'range' OR (price_max_cents IS NOT NULL AND price_max_cents >= price_cents)
  )
);

CREATE INDEX IF NOT EXISTS idx_pro_booking_services_business
  ON public.pro_booking_services (business_id, sort_order, created_at);

DROP TRIGGER IF EXISTS update_pro_booking_services_updated_at ON public.pro_booking_services;
CREATE TRIGGER update_pro_booking_services_updated_at
  BEFORE UPDATE ON public.pro_booking_services
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.pro_booking_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active booking services" ON public.pro_booking_services;
CREATE POLICY "Public can view active booking services"
  ON public.pro_booking_services
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "Owner manages booking services" ON public.pro_booking_services;
CREATE POLICY "Owner manages booking services"
  ON public.pro_booking_services
  FOR ALL
  TO authenticated
  USING (
    business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    business_id IN (SELECT id FROM public.businesses WHERE owner_id = auth.uid())
  );

COMMENT ON TABLE public.pro_booking_services IS
  'Contractor services shown on the business page and chosen when a customer books a ProEstimate.';

ALTER TABLE public.pro_estimate_bookings
  ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES public.pro_booking_services(id) ON DELETE SET NULL;

ALTER TABLE public.pro_estimate_bookings
  ADD COLUMN IF NOT EXISTS service_name TEXT;

COMMENT ON COLUMN public.pro_estimate_bookings.service_name IS
  'Service title at booking time, kept if the catalog row is later renamed or removed.';

-- Copy existing name-only services into the catalog once, so current listings show up as cards.
INSERT INTO public.pro_booking_services (business_id, name, sort_order)
SELECT
  b.id,
  left(btrim(label), 80),
  (ord - 1)::integer
FROM public.businesses b
CROSS JOIN LATERAL jsonb_array_elements(
  CASE
    WHEN jsonb_typeof(b.services) = 'array' THEN b.services
    ELSE '[]'::jsonb
  END
) WITH ORDINALITY AS items(elem, ord)
CROSS JOIN LATERAL (
  SELECT CASE
    WHEN jsonb_typeof(elem) = 'string' THEN elem #>> '{}'
    WHEN jsonb_typeof(elem) = 'object' THEN COALESCE(elem->>'name', '')
    ELSE ''
  END AS label
) AS named
WHERE char_length(btrim(label)) >= 2
  AND NOT EXISTS (
    SELECT 1 FROM public.pro_booking_services existing WHERE existing.business_id = b.id
  );
