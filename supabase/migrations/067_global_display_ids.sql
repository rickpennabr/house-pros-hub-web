-- Global display IDs (keep UUID PKs, add user-facing IDs)
-- Format: PREFIX-YYYY-000001

CREATE TABLE IF NOT EXISTS public.display_id_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_scope UUID NOT NULL,
  entity_code TEXT NOT NULL,
  year INTEGER NOT NULL,
  last_value INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT display_id_counters_unique_scope UNIQUE (owner_scope, entity_code, year)
);

CREATE TRIGGER update_display_id_counters_updated_at
  BEFORE UPDATE ON public.display_id_counters
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.display_id_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Display ID counters are service-only"
  ON public.display_id_counters
  FOR ALL
  USING (false)
  WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.next_display_id(
  p_entity_code TEXT,
  p_owner_id UUID DEFAULT NULL,
  p_created_at TIMESTAMPTZ DEFAULT now()
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_owner_scope UUID := COALESCE(p_owner_id, '00000000-0000-0000-0000-000000000000'::uuid);
  v_year INTEGER := EXTRACT(YEAR FROM (p_created_at AT TIME ZONE 'UTC'))::INTEGER;
  v_next INTEGER;
BEGIN
  INSERT INTO public.display_id_counters (owner_scope, entity_code, year, last_value)
  VALUES (v_owner_scope, p_entity_code, v_year, 1)
  ON CONFLICT (owner_scope, entity_code, year)
  DO UPDATE SET
    last_value = public.display_id_counters.last_value + 1,
    updated_at = now()
  RETURNING last_value INTO v_next;

  RETURN format('%s-%s-%s', p_entity_code, v_year, lpad(v_next::TEXT, 6, '0'));
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_display_id_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_entity_code TEXT := TG_ARGV[0];
  v_owner_column TEXT := COALESCE(TG_ARGV[1], '');
  v_owner_id UUID := NULL;
  v_created_at TIMESTAMPTZ := now();
  v_owner_text TEXT;
BEGIN
  IF NEW.display_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF v_owner_column <> '' THEN
    v_owner_text := to_jsonb(NEW)->>v_owner_column;
    IF v_owner_text IS NOT NULL AND v_owner_text <> '' THEN
      v_owner_id := v_owner_text::uuid;
    END IF;
  END IF;

  IF (to_jsonb(NEW)->>'created_at') IS NOT NULL THEN
    v_created_at := (to_jsonb(NEW)->>'created_at')::timestamptz;
  END IF;

  NEW.display_id := public.next_display_id(v_entity_code, v_owner_id, v_created_at);
  RETURN NEW;
END;
$$;

ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS display_id TEXT;
ALTER TABLE public.pro_crm_customers ADD COLUMN IF NOT EXISTS display_id TEXT;
ALTER TABLE public.pro_crm_estimates ADD COLUMN IF NOT EXISTS display_id TEXT;
ALTER TABLE public.pro_crm_invoices ADD COLUMN IF NOT EXISTS display_id TEXT;
ALTER TABLE public.pro_crm_projects ADD COLUMN IF NOT EXISTS display_id TEXT;
ALTER TABLE public.pro_crm_tasks ADD COLUMN IF NOT EXISTS display_id TEXT;
ALTER TABLE public.pro_crm_expenses ADD COLUMN IF NOT EXISTS display_id TEXT;
ALTER TABLE public.pro_crm_items ADD COLUMN IF NOT EXISTS display_id TEXT;
ALTER TABLE public.admin_notification_events ADD COLUMN IF NOT EXISTS display_id TEXT;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT id, owner_id, created_at
    FROM public.businesses
    WHERE display_id IS NULL
    ORDER BY created_at, id
  LOOP
    UPDATE public.businesses
    SET display_id = public.next_display_id('BIZ', r.owner_id, r.created_at)
    WHERE id = r.id;
  END LOOP;

  FOR r IN
    SELECT id, owner_id, created_at
    FROM public.pro_crm_customers
    WHERE display_id IS NULL
    ORDER BY created_at, id
  LOOP
    UPDATE public.pro_crm_customers
    SET display_id = public.next_display_id('CUS', r.owner_id, r.created_at)
    WHERE id = r.id;
  END LOOP;

  FOR r IN
    SELECT id, owner_id, created_at
    FROM public.pro_crm_estimates
    WHERE display_id IS NULL
    ORDER BY created_at, id
  LOOP
    UPDATE public.pro_crm_estimates
    SET display_id = public.next_display_id('EST', r.owner_id, r.created_at)
    WHERE id = r.id;
  END LOOP;

  FOR r IN
    SELECT id, owner_id, created_at
    FROM public.pro_crm_invoices
    WHERE display_id IS NULL
    ORDER BY created_at, id
  LOOP
    UPDATE public.pro_crm_invoices
    SET display_id = public.next_display_id('INV', r.owner_id, r.created_at)
    WHERE id = r.id;
  END LOOP;

  FOR r IN
    SELECT id, owner_id, created_at
    FROM public.pro_crm_projects
    WHERE display_id IS NULL
    ORDER BY created_at, id
  LOOP
    UPDATE public.pro_crm_projects
    SET display_id = public.next_display_id('PRJ', r.owner_id, r.created_at)
    WHERE id = r.id;
  END LOOP;

  FOR r IN
    SELECT id, owner_id, created_at
    FROM public.pro_crm_tasks
    WHERE display_id IS NULL
    ORDER BY created_at, id
  LOOP
    UPDATE public.pro_crm_tasks
    SET display_id = public.next_display_id('TSK', r.owner_id, r.created_at)
    WHERE id = r.id;
  END LOOP;

  FOR r IN
    SELECT id, owner_id, created_at
    FROM public.pro_crm_expenses
    WHERE display_id IS NULL
    ORDER BY created_at, id
  LOOP
    UPDATE public.pro_crm_expenses
    SET display_id = public.next_display_id('EXP', r.owner_id, r.created_at)
    WHERE id = r.id;
  END LOOP;

  FOR r IN
    SELECT id, owner_id, created_at
    FROM public.pro_crm_items
    WHERE display_id IS NULL
    ORDER BY created_at, id
  LOOP
    UPDATE public.pro_crm_items
    SET display_id = public.next_display_id('ITM', r.owner_id, r.created_at)
    WHERE id = r.id;
  END LOOP;

  FOR r IN
    SELECT id, created_at
    FROM public.admin_notification_events
    WHERE display_id IS NULL
    ORDER BY created_at, id
  LOOP
    UPDATE public.admin_notification_events
    SET display_id = public.next_display_id('ADM', NULL, r.created_at)
    WHERE id = r.id;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_businesses_owner_display_id
  ON public.businesses(owner_id, display_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pro_crm_customers_owner_display_id
  ON public.pro_crm_customers(owner_id, display_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pro_crm_estimates_owner_display_id
  ON public.pro_crm_estimates(owner_id, display_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pro_crm_invoices_owner_display_id
  ON public.pro_crm_invoices(owner_id, display_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pro_crm_projects_owner_display_id
  ON public.pro_crm_projects(owner_id, display_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pro_crm_tasks_owner_display_id
  ON public.pro_crm_tasks(owner_id, display_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pro_crm_expenses_owner_display_id
  ON public.pro_crm_expenses(owner_id, display_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pro_crm_items_owner_display_id
  ON public.pro_crm_items(owner_id, display_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_notification_events_display_id
  ON public.admin_notification_events(display_id);

ALTER TABLE public.businesses ALTER COLUMN display_id SET NOT NULL;
ALTER TABLE public.pro_crm_customers ALTER COLUMN display_id SET NOT NULL;
ALTER TABLE public.pro_crm_estimates ALTER COLUMN display_id SET NOT NULL;
ALTER TABLE public.pro_crm_invoices ALTER COLUMN display_id SET NOT NULL;
ALTER TABLE public.pro_crm_projects ALTER COLUMN display_id SET NOT NULL;
ALTER TABLE public.pro_crm_tasks ALTER COLUMN display_id SET NOT NULL;
ALTER TABLE public.pro_crm_expenses ALTER COLUMN display_id SET NOT NULL;
ALTER TABLE public.pro_crm_items ALTER COLUMN display_id SET NOT NULL;
ALTER TABLE public.admin_notification_events ALTER COLUMN display_id SET NOT NULL;

DROP TRIGGER IF EXISTS tr_businesses_assign_display_id ON public.businesses;
CREATE TRIGGER tr_businesses_assign_display_id
  BEFORE INSERT ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_display_id_trigger('BIZ', 'owner_id');

DROP TRIGGER IF EXISTS tr_pro_crm_customers_assign_display_id ON public.pro_crm_customers;
CREATE TRIGGER tr_pro_crm_customers_assign_display_id
  BEFORE INSERT ON public.pro_crm_customers
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_display_id_trigger('CUS', 'owner_id');

DROP TRIGGER IF EXISTS tr_pro_crm_estimates_assign_display_id ON public.pro_crm_estimates;
CREATE TRIGGER tr_pro_crm_estimates_assign_display_id
  BEFORE INSERT ON public.pro_crm_estimates
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_display_id_trigger('EST', 'owner_id');

DROP TRIGGER IF EXISTS tr_pro_crm_invoices_assign_display_id ON public.pro_crm_invoices;
CREATE TRIGGER tr_pro_crm_invoices_assign_display_id
  BEFORE INSERT ON public.pro_crm_invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_display_id_trigger('INV', 'owner_id');

DROP TRIGGER IF EXISTS tr_pro_crm_projects_assign_display_id ON public.pro_crm_projects;
CREATE TRIGGER tr_pro_crm_projects_assign_display_id
  BEFORE INSERT ON public.pro_crm_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_display_id_trigger('PRJ', 'owner_id');

DROP TRIGGER IF EXISTS tr_pro_crm_tasks_assign_display_id ON public.pro_crm_tasks;
CREATE TRIGGER tr_pro_crm_tasks_assign_display_id
  BEFORE INSERT ON public.pro_crm_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_display_id_trigger('TSK', 'owner_id');

DROP TRIGGER IF EXISTS tr_pro_crm_expenses_assign_display_id ON public.pro_crm_expenses;
CREATE TRIGGER tr_pro_crm_expenses_assign_display_id
  BEFORE INSERT ON public.pro_crm_expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_display_id_trigger('EXP', 'owner_id');

DROP TRIGGER IF EXISTS tr_pro_crm_items_assign_display_id ON public.pro_crm_items;
CREATE TRIGGER tr_pro_crm_items_assign_display_id
  BEFORE INSERT ON public.pro_crm_items
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_display_id_trigger('ITM', 'owner_id');

DROP TRIGGER IF EXISTS tr_admin_notification_events_assign_display_id ON public.admin_notification_events;
CREATE TRIGGER tr_admin_notification_events_assign_display_id
  BEFORE INSERT ON public.admin_notification_events
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_display_id_trigger('ADM', '');
