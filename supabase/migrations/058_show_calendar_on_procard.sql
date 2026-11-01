-- When true, show a calendar/booking icon on the ProCard; customers can book appointments via the shareable calendar link.
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS show_calendar_on_procard BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.businesses.show_calendar_on_procard IS 'When true, show calendar icon on ProCard and allow booking via shareable link (e.g. /book/<slug>).';
