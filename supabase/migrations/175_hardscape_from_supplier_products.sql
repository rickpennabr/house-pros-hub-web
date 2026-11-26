-- Hardscape database: bring in the supplier paver list (admin Products: base_products + product_variants,
-- Keystone and Las Vegas Paver). One catalog item per base product; its colors, thicknesses and sizes
-- become specs with several values, which ProQuote turns into choices. Pallet facts ride along.
-- No prices in the source: pros add their own. Safe to run again (updates, no duplicates).

WITH v AS (
  SELECT
    pv.base_product_id,
    string_agg(DISTINCT c.color_name, ', ' ORDER BY c.color_name) FILTER (WHERE c.color_name IS NOT NULL AND btrim(c.color_name) <> '') AS colors,
    string_agg(DISTINCT (t.thickness_mm || 'mm'), ', ') FILTER (WHERE t.thickness_mm IS NOT NULL) AS thicknesses,
    string_agg(DISTINCT pv.size, ', ') FILTER (WHERE pv.size IS NOT NULL AND btrim(pv.size) <> '') AS sizes,
    max(pv.sqft_pallet) AS sqft_pallet,
    max(pv.pcs_pallet) AS pcs_pallet,
    max(pv.lnft_pallet) AS lnft_pallet
  FROM public.product_variants pv
  LEFT JOIN public.colors c ON c.color_id = pv.color_id
  LEFT JOIN public.thicknesses t ON t.thickness_id = pv.thickness_id
  GROUP BY pv.base_product_id
),
source AS (
  SELECT
    bp.base_product_id,
    left(btrim(bp.product_name), 160) AS name,
    left(COALESCE(btrim(b.brand_name), ''), 120) AS brand,
    left(COALESCE(NULLIF(btrim(bp.product_type), ''), 'Paver'), 80) AS category,
    NULLIF(btrim(bp.product_note), '') AS description,
    NULLIF(btrim(bp.image_url), '') AS image_url,
    CASE
      WHEN bp.product_type ~* 'edg' THEN 'edging'
      WHEN bp.product_type ~* '(wall|coping|step|cap|outdoor living)' THEN 'wall_block'
      ELSE 'paver'
    END AS kind,
    v.colors, v.thicknesses, v.sizes, v.sqft_pallet, v.pcs_pallet, v.lnft_pallet
  FROM public.base_products bp
  LEFT JOIN public.brands b ON b.brand_id = bp.brand_id
  LEFT JOIN v ON v.base_product_id = bp.base_product_id
  WHERE btrim(COALESCE(bp.product_name, '')) <> ''
)
INSERT INTO public.trade_catalog_items
  (trade, kind, name, brand, category, description, image_url, unit, typical_price_cents, specs, region, is_active, sort_order)
SELECT DISTINCT ON (kind, lower(brand), lower(name))
  'hardscape', kind, name, brand, category, description, image_url,
  CASE kind WHEN 'paver' THEN 'sq ft' WHEN 'edging' THEN 'linear ft' ELSE 'each' END,
  NULL,
  (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('name', s.n, 'value', s.v)), '[]'::jsonb)
    FROM (VALUES
      ('Color', colors), ('Thickness', thicknesses), ('Size', sizes),
      ('Sq ft per pallet', sqft_pallet::text), ('Pieces per pallet', pcs_pallet::text), ('Linear ft per pallet', lnft_pallet::text)
    ) AS s(n, v)
    WHERE s.v IS NOT NULL AND s.v <> '' AND s.v <> '0'
  ),
  'las-vegas', true, 1000 + base_product_id
FROM source
ORDER BY kind, lower(brand), lower(name), base_product_id
ON CONFLICT (trade, kind, lower(brand), lower(name)) DO UPDATE SET
  category = EXCLUDED.category,
  description = COALESCE(EXCLUDED.description, trade_catalog_items.description),
  image_url = COALESCE(EXCLUDED.image_url, trade_catalog_items.image_url),
  unit = EXCLUDED.unit,
  specs = EXCLUDED.specs,
  is_active = true,
  updated_at = now();
