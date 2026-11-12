-- Trade on a catalog service (Hardscape, Landscape, and any name the contractor adds).

ALTER TABLE public.pro_crm_services
  ADD COLUMN IF NOT EXISTS trade TEXT;

ALTER TABLE public.pro_crm_catalog_terms
  DROP CONSTRAINT IF EXISTS pro_crm_catalog_terms_kind_check;

ALTER TABLE public.pro_crm_catalog_terms
  ADD CONSTRAINT pro_crm_catalog_terms_kind_check
  CHECK (kind IN ('service_category', 'product_category', 'unit', 'price_type', 'spec_name', 'service_trade'));
