-- Hardscape database: bring back the pavers and wall block from the admin's own CRM products
-- (Keystone and Las Vegas Pavers). Migration 156 cleared the Hardscape list for the rock yard.
-- Copies name, brand, category, description, unit, price, first photo (thumbnail first) and specs,
-- then links each admin product to its database item (trade = hardscape, catalog_item_id).
-- Safe to run again: existing items (same trade, kind, brand, name) are updated, not duplicated.

WITH source AS (
  SELECT
    p.id AS product_id,
    p.owner_id,
    btrim(p.name) AS name,
    btrim(p.brand) AS brand,
    NULLIF(btrim(p.category), '') AS category,
    NULLIF(btrim(p.description), '') AS description,
    COALESCE(NULLIF(btrim(p.unit), ''), 'sq ft') AS unit,
    NULLIF(p.price_cents, 0) AS price_cents,
    p.display_order,
    CASE
      WHEN concat_ws(' ', p.category, p.name) ~* '(wall|block|cap|column|pillar|step)' THEN 'wall_block'
      ELSE 'paver'
    END AS kind,
    (
      SELECT i.image_url
      FROM public.pro_crm_product_images i
      WHERE i.product_id = p.id
      ORDER BY i.is_thumbnail DESC, i.sort_order, i.created_at
      LIMIT 1
    ) AS image_url,
    COALESCE(
      (
        SELECT jsonb_agg(jsonb_build_object('name', left(s.name, 80), 'value', left(s.value, 200)) ORDER BY s.sort_order)
        FROM public.pro_crm_product_specs s
        WHERE s.product_id = p.id AND btrim(s.name) <> '' AND btrim(s.value) <> ''
      ),
      '[]'::jsonb
    ) AS specs
  FROM public.pro_crm_products p
  WHERE p.owner_id IN (SELECT user_id FROM public.admin_users)
    AND p.status = 'active'
    AND (
      concat_ws(' ', p.brand, p.name) ~* 'keystone'
      OR concat_ws(' ', p.brand, p.name) ~* '(las ?vegas|lv) ?pavers?'
    )
),
upserted AS (
  INSERT INTO public.trade_catalog_items
    (trade, kind, name, brand, category, description, image_url, unit, typical_price_cents, specs, region, is_active, sort_order)
  SELECT DISTINCT ON (kind, lower(brand), lower(name))
    'hardscape', kind, left(name, 160), left(brand, 120), left(COALESCE(category, CASE WHEN kind = 'wall_block' THEN 'Wall block' ELSE 'Pavers' END), 80),
    left(description, 4000), image_url, left(unit, 40), price_cents, specs, 'las-vegas', true, 1000 + display_order
  FROM source
  ORDER BY kind, lower(brand), lower(name), display_order
  ON CONFLICT (trade, kind, lower(brand), lower(name)) DO UPDATE SET
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    image_url = COALESCE(EXCLUDED.image_url, public.trade_catalog_items.image_url),
    unit = EXCLUDED.unit,
    typical_price_cents = EXCLUDED.typical_price_cents,
    specs = EXCLUDED.specs,
    is_active = true
  RETURNING id, kind, brand, name
)
UPDATE public.pro_crm_products p
SET trade = 'hardscape', catalog_item_id = u.id
FROM source s
JOIN upserted u ON u.kind = s.kind AND lower(u.brand) = lower(left(s.brand, 120)) AND lower(u.name) = lower(left(s.name, 160))
WHERE p.id = s.product_id;
