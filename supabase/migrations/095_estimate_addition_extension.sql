-- Allow Addition/Extension as an estimate project type.
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'estimates'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%project_type%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.estimates DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.estimates
  ADD CONSTRAINT estimates_project_type_check
  CHECK (project_type IN (
    'new_construction',
    'renovation',
    'repair',
    'remodel',
    'addition_extension',
    'other'
  ));
