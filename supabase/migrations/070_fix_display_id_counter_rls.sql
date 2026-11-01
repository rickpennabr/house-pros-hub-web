-- Fix RLS violations for display ID generation.
-- The counter table is intentionally service-only; these functions must run as definer.

CREATE OR REPLACE FUNCTION public.next_display_id(
  p_entity_code TEXT,
  p_owner_id UUID DEFAULT NULL,
  p_created_at TIMESTAMPTZ DEFAULT now()
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
SECURITY DEFINER
SET search_path = public
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
