-- House trades: every pro picks a primary trade (from foundation to roof, plus home services).
-- The trade is the title on their card and details page ("Plumber", "House Cleaner").
-- Slugs are defined in lib/pros/house-trades.ts.

ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS primary_trade TEXT;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS trades TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.businesses DROP CONSTRAINT IF EXISTS businesses_primary_trade_length;
ALTER TABLE public.businesses ADD CONSTRAINT businesses_primary_trade_length
  CHECK (primary_trade IS NULL OR char_length(primary_trade) BETWEEN 2 AND 40);

ALTER TABLE public.businesses DROP CONSTRAINT IF EXISTS businesses_trades_count;
ALTER TABLE public.businesses ADD CONSTRAINT businesses_trades_count
  CHECK (cardinality(trades) <= 8);

CREATE INDEX IF NOT EXISTS idx_businesses_primary_trade ON public.businesses (primary_trade);
CREATE INDEX IF NOT EXISTS idx_businesses_trades ON public.businesses USING GIN (trades);

-- Service pros (cleaners, pool service, pest control, movers...) need no contractor license.
INSERT INTO public.license_categories (code, name, description, requires_contractor_license, sort_order, role)
VALUES (
  'NV_BUSINESS',
  'Nevada Business License',
  'Home services that need no contractor license (cleaning, pool service, pest control, moving). Nevada Business License only.',
  false,
  1,
  'contractor'
)
ON CONFLICT (code) DO NOTHING;
