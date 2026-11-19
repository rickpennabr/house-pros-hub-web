-- ProTools: the business's tools and equipment.
-- Each item has a purchase cost and straight-line depreciation (book value for company valuation),
-- a status, who has it, and where it is working (a project or a maintenance house).
-- Expenses link to an item (purchase, repairs, parts) the same way they link to vehicles.

CREATE TABLE IF NOT EXISTS public.pro_crm_tools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'tool' CHECK (kind IN ('tool', 'equipment')),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  category TEXT CHECK (category IS NULL OR char_length(category) <= 60),
  brand TEXT CHECK (brand IS NULL OR char_length(brand) <= 80),
  model TEXT CHECK (model IS NULL OR char_length(model) <= 80),
  serial_number TEXT CHECK (serial_number IS NULL OR char_length(serial_number) <= 80),
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 10000),
  purchase_date DATE,
  purchase_cents INTEGER NOT NULL DEFAULT 0 CHECK (purchase_cents >= 0),
  useful_life_years NUMERIC(4,1) NOT NULL DEFAULT 5 CHECK (useful_life_years > 0 AND useful_life_years <= 50),
  salvage_cents INTEGER NOT NULL DEFAULT 0 CHECK (salvage_cents >= 0),
  status TEXT NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'in_use', 'repair', 'retired', 'lost')),
  assigned_crew_id UUID REFERENCES public.business_crew_members(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.pro_crm_projects(id) ON DELETE SET NULL,
  maintenance_plan_id UUID REFERENCES public.pro_crm_maintenance_plans(id) ON DELETE SET NULL,
  location TEXT CHECK (location IS NULL OR char_length(location) <= 120),
  next_service_date DATE,
  photo_drive_file_id UUID REFERENCES public.pro_drive_files(id) ON DELETE SET NULL,
  note TEXT CHECK (note IS NULL OR char_length(note) <= 2000),
  retired_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pro_crm_tools_owner ON public.pro_crm_tools (owner_id, status);
CREATE INDEX IF NOT EXISTS idx_pro_crm_tools_project ON public.pro_crm_tools (project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pro_crm_tools_plan ON public.pro_crm_tools (maintenance_plan_id) WHERE maintenance_plan_id IS NOT NULL;

DROP TRIGGER IF EXISTS update_pro_crm_tools_updated_at ON public.pro_crm_tools;
CREATE TRIGGER update_pro_crm_tools_updated_at
  BEFORE UPDATE ON public.pro_crm_tools
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.pro_crm_tools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage their tools" ON public.pro_crm_tools;
CREATE POLICY "Owners manage their tools"
  ON public.pro_crm_tools
  FOR ALL
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pro_crm_tools TO authenticated;
GRANT ALL ON public.pro_crm_tools TO service_role;

COMMENT ON TABLE public.pro_crm_tools IS
  'ProTools: tools and equipment the business owns, with cost, depreciation, and where each one is.';
COMMENT ON COLUMN public.pro_crm_tools.useful_life_years IS
  'Years the item is expected to last; book value drops in a straight line to salvage_cents.';

-- Where an item has been: each change of person, project, house, or status.
CREATE TABLE IF NOT EXISTS public.pro_crm_tool_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id UUID NOT NULL REFERENCES public.pro_crm_tools(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT,
  assigned_crew_id UUID REFERENCES public.business_crew_members(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.pro_crm_projects(id) ON DELETE SET NULL,
  maintenance_plan_id UUID REFERENCES public.pro_crm_maintenance_plans(id) ON DELETE SET NULL,
  note TEXT CHECK (note IS NULL OR char_length(note) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pro_crm_tool_events_tool ON public.pro_crm_tool_events (tool_id, created_at DESC);

ALTER TABLE public.pro_crm_tool_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners read their tool events" ON public.pro_crm_tool_events;
CREATE POLICY "Owners read their tool events"
  ON public.pro_crm_tool_events
  FOR ALL
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pro_crm_tool_events TO authenticated;
GRANT ALL ON public.pro_crm_tool_events TO service_role;

-- Purchase, repairs, parts: expenses filed on one item.
ALTER TABLE public.pro_crm_expenses
  ADD COLUMN IF NOT EXISTS tool_id UUID REFERENCES public.pro_crm_tools(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pro_crm_expenses_tool_id
  ON public.pro_crm_expenses (tool_id)
  WHERE tool_id IS NOT NULL;

COMMENT ON COLUMN public.pro_crm_expenses.tool_id IS
  'Tool or equipment this expense was for (purchase, repair, parts).';
