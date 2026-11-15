-- Admin-controlled order of the public main menu (ProJobs, HousePros, and the rest).
CREATE TABLE IF NOT EXISTS public.site_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS site_settings_public_read ON public.site_settings;
CREATE POLICY site_settings_public_read ON public.site_settings
  FOR SELECT
  TO anon, authenticated
  USING (key = 'main_menu_order');

COMMENT ON TABLE public.site_settings IS 'Small site-wide settings. main_menu_order is the public header menu.';

NOTIFY pgrst, 'reload schema';
