-- ProsCRM: calendar availability / events (work hours, off, appointments). ProBot can read for scheduling.
CREATE TABLE IF NOT EXISTS public.pro_crm_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('available', 'unavailable', 'appointment')),
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pro_crm_availability_end_after_start CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS idx_pro_crm_availability_owner_id ON public.pro_crm_availability(owner_id);
CREATE INDEX IF NOT EXISTS idx_pro_crm_availability_start_at ON public.pro_crm_availability(start_at);
CREATE INDEX IF NOT EXISTS idx_pro_crm_availability_end_at ON public.pro_crm_availability(end_at);

CREATE TRIGGER update_pro_crm_availability_updated_at
  BEFORE UPDATE ON public.pro_crm_availability
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.pro_crm_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contractors can manage own CRM availability"
  ON public.pro_crm_availability
  FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

COMMENT ON TABLE public.pro_crm_availability IS 'ProsCRM: contractor availability and calendar events for ProBot scheduling.';
