-- Remove every_15_days; keep biweekly (every two weeks).
-- 135 already applied with every_15_days; this tightens the checks.

UPDATE public.pro_crm_estimates
SET maintenance_frequency = 'biweekly'
WHERE maintenance_frequency = 'every_15_days';

UPDATE public.pro_crm_maintenance_plans
SET frequency = 'biweekly'
WHERE frequency = 'every_15_days';

ALTER TABLE public.pro_crm_estimates
  DROP CONSTRAINT IF EXISTS pro_crm_estimates_maintenance_frequency_check;

ALTER TABLE public.pro_crm_estimates
  ADD CONSTRAINT pro_crm_estimates_maintenance_frequency_check
  CHECK (
    maintenance_frequency IS NULL
    OR maintenance_frequency IN (
      'weekly',
      'biweekly',
      'monthly',
      'quarterly',
      'yearly'
    )
  );

ALTER TABLE public.pro_crm_maintenance_plans
  DROP CONSTRAINT IF EXISTS pro_crm_maintenance_plans_frequency_check;

ALTER TABLE public.pro_crm_maintenance_plans
  ADD CONSTRAINT pro_crm_maintenance_plans_frequency_check
  CHECK (frequency IN (
    'weekly',
    'biweekly',
    'monthly',
    'quarterly',
    'yearly'
  ));
