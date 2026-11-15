-- Businesses a person saved. They belong to the user, not to a business profile.

CREATE TABLE IF NOT EXISTS public.saved_businesses (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, business_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_businesses_business
  ON public.saved_businesses (business_id);

ALTER TABLE public.saved_businesses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read their saved businesses" ON public.saved_businesses;
CREATE POLICY "Users read their saved businesses"
  ON public.saved_businesses FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users save a business" ON public.saved_businesses;
CREATE POLICY "Users save a business"
  ON public.saved_businesses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users unsave a business" ON public.saved_businesses;
CREATE POLICY "Users unsave a business"
  ON public.saved_businesses FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, DELETE ON public.saved_businesses TO authenticated;
GRANT ALL ON public.saved_businesses TO service_role;
