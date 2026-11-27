-- Live trip tracking (GPS) for pros.
-- Trip types: the pro's own list (Estimate, Project visit, Sales follow-up...), kept for next time.
-- Trips gain the route (start/end points, simplified encoded polyline) and when it started/ended.
-- pro_crm_trip_live: the one trip in progress per pro, saved every ~30s so a refresh never loses it.

CREATE TABLE IF NOT EXISTS public.pro_crm_trip_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 40),
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS pro_crm_trip_types_owner_label
  ON public.pro_crm_trip_types (owner_id, lower(btrim(label)));

ALTER TABLE public.pro_crm_trip_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners manage their trip types" ON public.pro_crm_trip_types;
CREATE POLICY "Owners manage their trip types" ON public.pro_crm_trip_types
  FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

ALTER TABLE public.pro_crm_mileage_trips
  ADD COLUMN IF NOT EXISTS trip_type_id UUID REFERENCES public.pro_crm_trip_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS start_lat NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS start_lng NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS end_lat NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS end_lng NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS route_polyline TEXT CHECK (route_polyline IS NULL OR char_length(route_polyline) <= 20000),
  ADD COLUMN IF NOT EXISTS tracked BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_pro_crm_mileage_trips_type ON public.pro_crm_mileage_trips (trip_type_id);

CREATE TABLE IF NOT EXISTS public.pro_crm_trip_live (
  owner_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES public.pro_crm_vehicles(id) ON DELETE SET NULL,
  trip_type_id UUID REFERENCES public.pro_crm_trip_types(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.pro_crm_customers(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  points JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pro_crm_trip_live ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners manage their live trip" ON public.pro_crm_trip_live;
CREATE POLICY "Owners manage their live trip" ON public.pro_crm_trip_live
  FOR ALL USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
