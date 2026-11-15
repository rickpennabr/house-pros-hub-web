-- Public profile tab order. Owners drag the tabs; visitors see this sequence.
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS tab_order JSONB NOT NULL DEFAULT '["contact","hours","services","links","images","about"]'::jsonb;

COMMENT ON COLUMN public.businesses.tab_order IS 'Order of tabs on the public business page.';

NOTIFY pgrst, 'reload schema';
