-- CRM commercial agreements: project type, maintenance cadence, e-sign evidence.
-- Accepting a maintenance estimate starts a place plan (and optional visit billing).

ALTER TABLE public.pro_crm_estimates
  ADD COLUMN IF NOT EXISTS agreement_kind TEXT NOT NULL DEFAULT 'project',
  ADD COLUMN IF NOT EXISTS maintenance_frequency TEXT,
  ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signer_name TEXT,
  ADD COLUMN IF NOT EXISTS signature_data TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pro_crm_estimates_agreement_kind_check'
  ) THEN
    ALTER TABLE public.pro_crm_estimates
      ADD CONSTRAINT pro_crm_estimates_agreement_kind_check
      CHECK (agreement_kind IN (
        'project',
        'maintenance',
        'repair',
        'renovation',
        'remodel',
        'addition',
        'other'
      ));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pro_crm_estimates_maintenance_frequency_check'
  ) THEN
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
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pro_crm_estimates_signer_name_len'
  ) THEN
    ALTER TABLE public.pro_crm_estimates
      ADD CONSTRAINT pro_crm_estimates_signer_name_len
      CHECK (signer_name IS NULL OR char_length(btrim(signer_name)) BETWEEN 1 AND 120);
  END IF;
END $$;

COMMENT ON COLUMN public.pro_crm_estimates.agreement_kind IS
  'Commercial document type shown to the customer: project, maintenance, repair, renovation, …';
COMMENT ON COLUMN public.pro_crm_estimates.maintenance_frequency IS
  'When agreement_kind is maintenance: visit cadence baked into the signed document.';
COMMENT ON COLUMN public.pro_crm_estimates.signed_at IS
  'When the customer signed/approved the agreement.';
COMMENT ON COLUMN public.pro_crm_estimates.signer_name IS
  'Typed or captured name used as signature evidence.';
COMMENT ON COLUMN public.pro_crm_estimates.signature_data IS
  'Optional signature payload (typed name echo or compact stroke data URL).';

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

ALTER TABLE public.pro_crm_maintenance_plans
  ADD COLUMN IF NOT EXISTS source_estimate_id UUID REFERENCES public.pro_crm_estimates(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_maintenance_plan_source_estimate
  ON public.pro_crm_maintenance_plans (source_estimate_id)
  WHERE source_estimate_id IS NOT NULL;

COMMENT ON COLUMN public.pro_crm_maintenance_plans.source_estimate_id IS
  'CRM estimate/agreement that started this repeating service (idempotent on accept).';
