-- One national product catalog: markets, suppliers and availability (price by market, with source and date).
-- trade_catalog_items stays the catalog of facts. Prices and regions move to catalog_availability.
-- Prices are for pros only (ProTrades database): no public read policies here.
-- Safe to run again.

CREATE TABLE IF NOT EXISTS public.catalog_markets (
  slug TEXT PRIMARY KEY CHECK (slug ~ '^[a-z0-9-]{2,40}$'),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  state TEXT NOT NULL CHECK (state ~ '^[A-Z]{2}$'),
  climate_zone TEXT CHECK (climate_zone IS NULL OR char_length(climate_zone) <= 10),
  time_zone TEXT NOT NULL DEFAULT 'America/Los_Angeles',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.catalog_markets (slug, name, state, climate_zone, time_zone)
VALUES ('las-vegas', 'Las Vegas', 'NV', '9a', 'America/Los_Angeles')
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.catalog_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market TEXT NOT NULL REFERENCES public.catalog_markets(slug),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  address TEXT CHECK (address IS NULL OR char_length(address) <= 300),
  website TEXT CHECK (website IS NULL OR char_length(website) <= 300),
  delivery_notes TEXT CHECK (delivery_notes IS NULL OR char_length(delivery_notes) <= 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS catalog_suppliers_unique ON public.catalog_suppliers (market, lower(name));

CREATE TABLE IF NOT EXISTS public.catalog_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.trade_catalog_items(id) ON DELETE CASCADE,
  market TEXT NOT NULL REFERENCES public.catalog_markets(slug),
  supplier_id UUID REFERENCES public.catalog_suppliers(id) ON DELETE SET NULL,
  price_cents INTEGER CHECK (price_cents IS NULL OR price_cents >= 0),
  unit TEXT NOT NULL DEFAULT 'each' CHECK (char_length(unit) BETWEEN 1 AND 40),
  in_stock BOOLEAN NOT NULL DEFAULT true,
  source TEXT CHECK (source IS NULL OR char_length(source) <= 200),
  as_of DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS catalog_availability_unique
  ON public.catalog_availability (item_id, market, COALESCE(supplier_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX IF NOT EXISTS catalog_availability_market ON public.catalog_availability (market, item_id);

-- Each pro account works in one market (metro area).
CREATE TABLE IF NOT EXISTS public.pro_markets (
  owner_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  market TEXT NOT NULL DEFAULT 'las-vegas' REFERENCES public.catalog_markets(slug),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.catalog_markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pro_markets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS catalog_markets_read ON public.catalog_markets;
CREATE POLICY catalog_markets_read ON public.catalog_markets FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS pro_markets_own ON public.pro_markets;
CREATE POLICY pro_markets_own ON public.pro_markets FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
-- Suppliers and availability: read and written through the server (service role) only; admins manage them.

-- Backfill: today's price on each catalog item becomes its Las Vegas availability.
INSERT INTO public.catalog_availability (item_id, market, price_cents, unit, source, as_of)
SELECT i.id,
       CASE WHEN EXISTS (SELECT 1 FROM public.catalog_markets m WHERE m.slug = i.region) THEN i.region ELSE 'las-vegas' END,
       i.typical_price_cents,
       i.unit,
       CASE WHEN i.brand = 'Star Nursery' THEN 'Star Nursery retail list' ELSE 'Hub database' END,
       CASE WHEN i.brand = 'Star Nursery' THEN DATE '2026-11-09' ELSE i.updated_at::date END
FROM public.trade_catalog_items i
WHERE i.typical_price_cents IS NOT NULL
ON CONFLICT DO NOTHING;
