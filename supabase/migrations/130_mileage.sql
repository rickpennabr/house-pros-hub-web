-- Vehicle cost inputs and the trips priced from them.
-- Fuel, insurance, repairs, and the other yearly amounts already live on expenses.
-- A trip stores miles and the calculated cost. It does not copy that cost into expenses,
-- so the same gas and insurance are not counted twice. expense_id is reserved for a later bill.

CREATE TABLE IF NOT EXISTS public.pro_crm_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  mpg NUMERIC(6,2),
  fuel_price_cents INTEGER,
  annual_miles NUMERIC(10,1),
  average_trip_miles NUMERIC(8,1),
  insurance_cents INTEGER NOT NULL DEFAULT 0,
  maintenance_cents INTEGER NOT NULL DEFAULT 0,
  registration_cents INTEGER NOT NULL DEFAULT 0,
  tires_cents INTEGER NOT NULL DEFAULT 0,
  depreciation_cents INTEGER NOT NULL DEFAULT 0,
  other_cents INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pro_crm_vehicles_name_len CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  CONSTRAINT pro_crm_vehicles_mpg_range CHECK (mpg IS NULL OR (mpg > 0 AND mpg <= 200)),
  CONSTRAINT pro_crm_vehicles_fuel_price_range CHECK (fuel_price_cents IS NULL OR (fuel_price_cents >= 0 AND fuel_price_cents <= 9900)),
  CONSTRAINT pro_crm_vehicles_annual_miles_range CHECK (annual_miles IS NULL OR (annual_miles > 0 AND annual_miles <= 500000)),
  CONSTRAINT pro_crm_vehicles_trip_miles_range CHECK (average_trip_miles IS NULL OR (average_trip_miles >= 0 AND average_trip_miles <= 5000)),
  CONSTRAINT pro_crm_vehicles_yearly_nonnegative CHECK (
    insurance_cents >= 0 AND maintenance_cents >= 0 AND registration_cents >= 0
    AND tires_cents >= 0 AND depreciation_cents >= 0 AND other_cents >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_pro_crm_vehicles_owner_id ON public.pro_crm_vehicles(owner_id);

DROP TRIGGER IF EXISTS update_pro_crm_vehicles_updated_at ON public.pro_crm_vehicles;
CREATE TRIGGER update_pro_crm_vehicles_updated_at
  BEFORE UPDATE ON public.pro_crm_vehicles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.pro_crm_vehicles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Contractors can manage own CRM vehicles" ON public.pro_crm_vehicles;
CREATE POLICY "Contractors can manage own CRM vehicles"
  ON public.pro_crm_vehicles
  FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

COMMENT ON TABLE public.pro_crm_vehicles IS
  'Cost inputs for one vehicle: miles per gallon, gas price, yearly miles, and yearly ownership costs.';
COMMENT ON COLUMN public.pro_crm_vehicles.mpg IS 'Average miles driven per gallon.';
COMMENT ON COLUMN public.pro_crm_vehicles.annual_miles IS 'Miles this vehicle is expected to drive in a year. Spreads insurance and the other yearly costs.';
COMMENT ON COLUMN public.pro_crm_vehicles.average_trip_miles IS 'Typical trip length used to show an average trip cost.';

ALTER TABLE public.pro_crm_expenses
  ADD COLUMN IF NOT EXISTS vehicle_id UUID REFERENCES public.pro_crm_vehicles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pro_crm_expenses_vehicle_id
  ON public.pro_crm_expenses(vehicle_id)
  WHERE vehicle_id IS NOT NULL;

COMMENT ON COLUMN public.pro_crm_expenses.vehicle_id IS
  'Vehicle this cost belongs to. Fuel, insurance, and repairs tagged here feed the vehicle cost. Mileage is not an input.';

CREATE TABLE IF NOT EXISTS public.pro_crm_mileage_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES public.pro_crm_vehicles(id) ON DELETE SET NULL,
  vehicle_name TEXT NOT NULL,
  customer_id UUID REFERENCES public.pro_crm_customers(id) ON DELETE SET NULL,
  estimate_id UUID REFERENCES public.pro_crm_estimates(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.pro_crm_projects(id) ON DELETE SET NULL,
  trip_date DATE NOT NULL DEFAULT (CURRENT_DATE),
  purpose TEXT NOT NULL DEFAULT 'job',
  origin_label TEXT,
  destination_label TEXT,
  miles NUMERIC(8,1) NOT NULL,
  cost_per_mile_cents NUMERIC(12,4) NOT NULL,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  expense_id UUID UNIQUE REFERENCES public.pro_crm_expenses(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pro_crm_mileage_trips_purpose CHECK (purpose IN ('job', 'estimate', 'supply_run', 'other')),
  CONSTRAINT pro_crm_mileage_trips_miles_range CHECK (miles > 0 AND miles <= 5000),
  CONSTRAINT pro_crm_mileage_trips_amount_nonnegative CHECK (amount_cents >= 0)
);

CREATE INDEX IF NOT EXISTS idx_pro_crm_mileage_trips_owner_date
  ON public.pro_crm_mileage_trips(owner_id, trip_date DESC);
CREATE INDEX IF NOT EXISTS idx_pro_crm_mileage_trips_vehicle
  ON public.pro_crm_mileage_trips(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_pro_crm_mileage_trips_customer
  ON public.pro_crm_mileage_trips(customer_id);
CREATE INDEX IF NOT EXISTS idx_pro_crm_mileage_trips_estimate
  ON public.pro_crm_mileage_trips(estimate_id);

DROP TRIGGER IF EXISTS update_pro_crm_mileage_trips_updated_at ON public.pro_crm_mileage_trips;
CREATE TRIGGER update_pro_crm_mileage_trips_updated_at
  BEFORE UPDATE ON public.pro_crm_mileage_trips
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.pro_crm_mileage_trips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Contractors can manage own CRM mileage trips" ON public.pro_crm_mileage_trips;
CREATE POLICY "Contractors can manage own CRM mileage trips"
  ON public.pro_crm_mileage_trips
  FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

COMMENT ON TABLE public.pro_crm_mileage_trips IS
  'One drive, priced from the vehicle rate at save time. The amount is the calculated cost, not a second expense.';
COMMENT ON COLUMN public.pro_crm_mileage_trips.cost_per_mile_cents IS
  'Cents per mile copied from the vehicle when the trip was saved. Later vehicle edits do not change it.';
COMMENT ON COLUMN public.pro_crm_mileage_trips.vehicle_name IS
  'Vehicle name at save time, kept if the vehicle is renamed or removed.';
