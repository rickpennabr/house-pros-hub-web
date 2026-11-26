-- Keep the Hardscape sources apart: the paver catalog (Keystone, Las Vegas Paver…) and the
-- Star Nursery rock yard are separate collections. Pages filter by collection; nothing links them.
-- Run after 175. Safe to run again.

ALTER TABLE public.trade_catalog_items
  ADD COLUMN IF NOT EXISTS collection TEXT CHECK (collection IS NULL OR collection ~ '^[a-z0-9-]{2,40}$');

UPDATE public.trade_catalog_items
SET collection = 'rock-yard'
WHERE brand = 'Star Nursery' AND collection IS DISTINCT FROM 'rock-yard';

UPDATE public.trade_catalog_items
SET collection = 'pavers'
WHERE trade = 'hardscape'
  AND brand <> 'Star Nursery'
  AND kind IN ('paver', 'wall_block', 'edging')
  AND collection IS NULL;

CREATE INDEX IF NOT EXISTS trade_catalog_items_collection
  ON public.trade_catalog_items (trade, collection, is_active);
