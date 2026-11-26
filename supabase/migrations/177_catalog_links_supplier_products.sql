-- One source of truth for pavers: the admin Products list (base_products + product_variants) is the master;
-- each Hardscape catalog item links to its base product and is kept in step by triggers.
-- Edit a product, color, thickness or size in Admin → Products and the Hardscape database follows.
-- Deleting a base product hides its catalog item (pros' saved products and estimates keep working).
-- The customer products page is not touched. Run after 175 and 176. Safe to run again.

ALTER TABLE public.trade_catalog_items
  ADD COLUMN IF NOT EXISTS base_product_id INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS trade_catalog_items_base_product
  ON public.trade_catalog_items (base_product_id) WHERE base_product_id IS NOT NULL;

-- Link the items migration 175 created (same trade, brand and name).
UPDATE public.trade_catalog_items i
SET base_product_id = bp.base_product_id
FROM public.base_products bp
LEFT JOIN public.brands b ON b.brand_id = bp.brand_id
WHERE i.trade = 'hardscape'
  AND i.base_product_id IS NULL
  AND lower(i.name) = lower(left(btrim(bp.product_name), 160))
  AND lower(i.brand) = lower(left(COALESCE(btrim(b.brand_name), ''), 120))
  AND NOT EXISTS (SELECT 1 FROM public.trade_catalog_items x WHERE x.base_product_id = bp.base_product_id);

CREATE OR REPLACE FUNCTION public.sync_base_product_to_catalog(p_id INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bp RECORD;
  v RECORD;
  v_kind TEXT;
  v_brand TEXT;
  v_specs JSONB;
  v_item UUID;
BEGIN
  SELECT * INTO bp FROM base_products WHERE base_product_id = p_id;
  IF NOT FOUND OR btrim(COALESCE(bp.product_name, '')) = '' THEN
    UPDATE trade_catalog_items SET is_active = false, updated_at = now() WHERE base_product_id = p_id;
    RETURN;
  END IF;

  SELECT left(COALESCE(btrim(brand_name), ''), 120) INTO v_brand FROM brands WHERE brand_id = bp.brand_id;
  v_brand := COALESCE(v_brand, '');
  v_kind := CASE
    WHEN bp.product_type ~* 'edg' THEN 'edging'
    WHEN bp.product_type ~* '(wall|coping|step|cap|outdoor living)' THEN 'wall_block'
    ELSE 'paver'
  END;

  SELECT
    string_agg(DISTINCT c.color_name, ', ' ORDER BY c.color_name) FILTER (WHERE btrim(COALESCE(c.color_name, '')) <> '') AS colors,
    string_agg(DISTINCT (t.thickness_mm || 'mm'), ', ') FILTER (WHERE t.thickness_mm IS NOT NULL) AS thicknesses,
    string_agg(DISTINCT pv.size, ', ') FILTER (WHERE btrim(COALESCE(pv.size, '')) <> '') AS sizes,
    max(pv.sqft_pallet) AS sqft_pallet, max(pv.pcs_pallet) AS pcs_pallet, max(pv.lnft_pallet) AS lnft_pallet
  INTO v
  FROM product_variants pv
  LEFT JOIN colors c ON c.color_id = pv.color_id
  LEFT JOIN thicknesses t ON t.thickness_id = pv.thickness_id
  WHERE pv.base_product_id = p_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('name', s.n, 'value', s.val)), '[]'::jsonb) INTO v_specs
  FROM (VALUES
    ('Color', v.colors), ('Thickness', v.thicknesses), ('Size', v.sizes),
    ('Sq ft per pallet', v.sqft_pallet::text), ('Pieces per pallet', v.pcs_pallet::text), ('Linear ft per pallet', v.lnft_pallet::text)
  ) AS s(n, val)
  WHERE s.val IS NOT NULL AND s.val <> '' AND s.val <> '0';

  SELECT id INTO v_item FROM trade_catalog_items WHERE base_product_id = p_id;
  IF v_item IS NULL THEN
    -- Adopt an unlinked item with the same name (from an older import) instead of adding a duplicate.
    SELECT id INTO v_item FROM trade_catalog_items
    WHERE trade = 'hardscape' AND base_product_id IS NULL AND kind = v_kind
      AND lower(brand) = lower(v_brand) AND lower(name) = lower(left(btrim(bp.product_name), 160))
    LIMIT 1;
  END IF;

  IF v_item IS NULL THEN
    INSERT INTO trade_catalog_items
      (trade, kind, name, brand, category, description, image_url, unit, specs, region, is_active, sort_order, collection, base_product_id)
    VALUES
      ('hardscape', v_kind, left(btrim(bp.product_name), 160), v_brand,
       left(COALESCE(NULLIF(btrim(bp.product_type), ''), 'Paver'), 80),
       NULLIF(btrim(COALESCE(bp.product_note, '')), ''), NULLIF(btrim(COALESCE(bp.image_url, '')), ''),
       CASE v_kind WHEN 'paver' THEN 'sq ft' WHEN 'edging' THEN 'linear ft' ELSE 'each' END,
       v_specs, 'las-vegas', true, 1000 + p_id, 'pavers', p_id)
    ON CONFLICT (trade, kind, lower(brand), lower(name)) DO NOTHING;
  ELSE
    UPDATE trade_catalog_items SET
      kind = v_kind,
      name = left(btrim(bp.product_name), 160),
      brand = v_brand,
      category = left(COALESCE(NULLIF(btrim(bp.product_type), ''), 'Paver'), 80),
      description = NULLIF(btrim(COALESCE(bp.product_note, '')), ''),
      image_url = COALESCE(NULLIF(btrim(COALESCE(bp.image_url, '')), ''), image_url),
      specs = v_specs,
      collection = 'pavers',
      base_product_id = p_id,
      is_active = true,
      updated_at = now()
    WHERE id = v_item;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_base_product_to_catalog(INTEGER) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.base_products_sync_catalog()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM sync_base_product_to_catalog(OLD.base_product_id);
    RETURN OLD;
  END IF;
  PERFORM sync_base_product_to_catalog(NEW.base_product_id);
  IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'product_variants' AND OLD.base_product_id IS DISTINCT FROM NEW.base_product_id THEN
    PERFORM sync_base_product_to_catalog(OLD.base_product_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS base_products_sync_catalog ON public.base_products;
CREATE TRIGGER base_products_sync_catalog
  AFTER INSERT OR UPDATE OR DELETE ON public.base_products
  FOR EACH ROW EXECUTE FUNCTION public.base_products_sync_catalog();

DROP TRIGGER IF EXISTS product_variants_sync_catalog ON public.product_variants;
CREATE TRIGGER product_variants_sync_catalog
  AFTER INSERT OR UPDATE OR DELETE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.base_products_sync_catalog();

-- Bring every product up to date once (also links anything 175 missed).
SELECT public.sync_base_product_to_catalog(base_product_id) FROM public.base_products;
