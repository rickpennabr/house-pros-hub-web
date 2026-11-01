-- Admin-defined display order for businesses (e.g. on /admin/businesses).
-- Lower value = higher in list. NULL = no custom order (sorts after ordered items).
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS display_order integer;

COMMENT ON COLUMN public.businesses.display_order IS 'Admin-defined sort order. Lower number = higher in list. NULL = use default (e.g. created_at).';

CREATE INDEX IF NOT EXISTS idx_businesses_display_order
  ON public.businesses (display_order ASC NULLS LAST);
