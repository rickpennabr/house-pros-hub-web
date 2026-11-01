-- ProEstimate: customer bookings for estimate appointments with a pro (business).
-- Used by "Book a ProEstimate" flow in ProBot; pros manage availability in CRM calendar.
CREATE TABLE IF NOT EXISTS public.pro_estimate_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  -- Customer: either signed-in user or guest
  customer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  guest_email TEXT,
  guest_first_name TEXT,
  guest_last_name TEXT,
  guest_phone TEXT,
  slot_start_at TIMESTAMPTZ NOT NULL,
  slot_end_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pro_estimate_bookings_end_after_start CHECK (slot_end_at > slot_start_at)
);

CREATE INDEX IF NOT EXISTS idx_pro_estimate_bookings_business_id ON public.pro_estimate_bookings(business_id);
CREATE INDEX IF NOT EXISTS idx_pro_estimate_bookings_customer_user_id ON public.pro_estimate_bookings(customer_user_id);
CREATE INDEX IF NOT EXISTS idx_pro_estimate_bookings_slot_start_at ON public.pro_estimate_bookings(slot_start_at);
CREATE INDEX IF NOT EXISTS idx_pro_estimate_bookings_status ON public.pro_estimate_bookings(status);

CREATE TRIGGER update_pro_estimate_bookings_updated_at
  BEFORE UPDATE ON public.pro_estimate_bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.pro_estimate_bookings ENABLE ROW LEVEL SECURITY;

-- Allow public to insert (guest or authenticated) for booking flow
CREATE POLICY "Anyone can create a pro estimate booking"
  ON public.pro_estimate_bookings
  FOR INSERT
  WITH CHECK (true);

-- Business owner can read their bookings
CREATE POLICY "Business owner can read own bookings"
  ON public.pro_estimate_bookings
  FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

-- Customer can read their own bookings (by user_id or we could allow by guest_email with a token; for now user only)
CREATE POLICY "Customer can read own bookings"
  ON public.pro_estimate_bookings
  FOR SELECT
  USING (customer_user_id = auth.uid());

-- Service role / API will need to read for availability checks (existing bookings); use service role in API
COMMENT ON TABLE public.pro_estimate_bookings IS 'ProEstimate: appointments booked by customers with a pro for estimates.';
