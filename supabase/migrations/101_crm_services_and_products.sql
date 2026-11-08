-- Split contractor catalog items into services and products.
-- Services keep a price layout (one price, unit price, or a from/to range).
-- Products keep only the columns every retail item has. Category-specific facts
-- (thickness, coverage, wattage, plant size) live in spec rows, the same way a
-- home-improvement catalog avoids a new column for every department.

CREATE TABLE IF NOT EXISTS public.pro_crm_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_id TEXT,
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  unit TEXT NOT NULL DEFAULT 'each',
  price_type TEXT NOT NULL DEFAULT 'Default',
  price_mode TEXT NOT NULL DEFAULT 'flat' CHECK (price_mode IN ('flat', 'unit', 'range')),
  price_cents INTEGER NOT NULL DEFAULT 0,
  price_min_cents INTEGER,
  price_max_cents INTEGER,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pro_crm_service_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES public.pro_crm_services(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  storage_path TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_thumbnail BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pro_crm_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_id TEXT,
  name TEXT NOT NULL,
  brand TEXT NOT NULL DEFAULT '',
  sku TEXT,
  upc TEXT,
  category TEXT,
  description TEXT,
  unit TEXT NOT NULL DEFAULT 'each',
  price_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft')),
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pro_crm_product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.pro_crm_products(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  storage_path TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_thumbnail BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pro_crm_product_specs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.pro_crm_products(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  value TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Saved categories, units, price types, and spec names. A value stays in the
-- list after it is added, even when no item currently uses it.
CREATE TABLE IF NOT EXISTS public.pro_crm_catalog_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('service_category', 'product_category', 'unit', 'price_type', 'spec_name')),
  label TEXT NOT NULL,
  label_key TEXT GENERATED ALWAYS AS (lower(btrim(label))) STORED,
  price_mode TEXT CHECK (price_mode IS NULL OR price_mode IN ('flat', 'unit', 'range')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pro_crm_catalog_terms_unique UNIQUE (owner_id, kind, label_key)
);

CREATE INDEX IF NOT EXISTS idx_pro_crm_services_owner ON public.pro_crm_services(owner_id, name);
CREATE INDEX IF NOT EXISTS idx_pro_crm_service_images_service ON public.pro_crm_service_images(service_id, sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pro_crm_service_images_thumbnail
  ON public.pro_crm_service_images(service_id) WHERE is_thumbnail;
CREATE INDEX IF NOT EXISTS idx_pro_crm_products_owner ON public.pro_crm_products(owner_id, name);
CREATE INDEX IF NOT EXISTS idx_pro_crm_product_images_product ON public.pro_crm_product_images(product_id, sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pro_crm_product_images_thumbnail
  ON public.pro_crm_product_images(product_id) WHERE is_thumbnail;
CREATE INDEX IF NOT EXISTS idx_pro_crm_product_specs_product ON public.pro_crm_product_specs(product_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_pro_crm_catalog_terms_owner ON public.pro_crm_catalog_terms(owner_id, kind);

-- Move the shared items list into the two tables. Keep the old ids so an open editor still matches.
INSERT INTO public.pro_crm_services (
  id, owner_id, name, category, description, unit, price_type, price_mode,
  price_cents, display_order, created_at, updated_at
)
SELECT
  id, owner_id, name, NULLIF(btrim(category), ''), description, COALESCE(NULLIF(btrim(unit), ''), 'each'),
  'Unit price', 'unit', price_cents, display_order, created_at, updated_at
FROM public.pro_crm_items
WHERE item_type = 'service'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.pro_crm_service_images (service_id, owner_id, image_url, sort_order, is_thumbnail)
SELECT id, owner_id, image_url, 0, true
FROM public.pro_crm_items
WHERE item_type = 'service' AND image_url IS NOT NULL AND btrim(image_url) <> ''
  AND EXISTS (SELECT 1 FROM public.pro_crm_services s WHERE s.id = pro_crm_items.id)
  AND NOT EXISTS (SELECT 1 FROM public.pro_crm_service_images i WHERE i.service_id = pro_crm_items.id);

INSERT INTO public.pro_crm_products (
  id, owner_id, name, sku, category, description, unit, price_cents, display_order, created_at, updated_at
)
SELECT
  id, owner_id, name, NULLIF(btrim(sku), ''), NULLIF(btrim(category), ''), description,
  COALESCE(NULLIF(btrim(unit), ''), 'each'), price_cents, display_order, created_at, updated_at
FROM public.pro_crm_items
WHERE item_type = 'product'
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.pro_crm_product_images (product_id, owner_id, image_url, sort_order, is_thumbnail)
SELECT id, owner_id, image_url, 0, true
FROM public.pro_crm_items
WHERE item_type = 'product' AND image_url IS NOT NULL AND btrim(image_url) <> ''
  AND EXISTS (SELECT 1 FROM public.pro_crm_products p WHERE p.id = pro_crm_items.id)
  AND NOT EXISTS (SELECT 1 FROM public.pro_crm_product_images i WHERE i.product_id = pro_crm_items.id);

INSERT INTO public.pro_crm_catalog_terms (owner_id, kind, label)
SELECT DISTINCT owner_id, 'service_category', btrim(category)
FROM public.pro_crm_items
WHERE item_type = 'service' AND category IS NOT NULL AND btrim(category) <> ''
ON CONFLICT ON CONSTRAINT pro_crm_catalog_terms_unique DO NOTHING;

INSERT INTO public.pro_crm_catalog_terms (owner_id, kind, label)
SELECT DISTINCT owner_id, 'product_category', btrim(category)
FROM public.pro_crm_items
WHERE item_type = 'product' AND category IS NOT NULL AND btrim(category) <> ''
ON CONFLICT ON CONSTRAINT pro_crm_catalog_terms_unique DO NOTHING;

INSERT INTO public.pro_crm_catalog_terms (owner_id, kind, label)
SELECT DISTINCT owner_id, 'unit', btrim(unit)
FROM public.pro_crm_items
WHERE unit IS NOT NULL AND btrim(unit) <> ''
ON CONFLICT ON CONSTRAINT pro_crm_catalog_terms_unique DO NOTHING;

DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT id, owner_id, created_at
    FROM public.pro_crm_services
    WHERE display_id IS NULL
    ORDER BY created_at, id
  LOOP
    UPDATE public.pro_crm_services
    SET display_id = public.next_display_id('SVC', r.owner_id, r.created_at)
    WHERE id = r.id;
  END LOOP;

  FOR r IN
    SELECT id, owner_id, created_at
    FROM public.pro_crm_products
    WHERE display_id IS NULL
    ORDER BY created_at, id
  LOOP
    UPDATE public.pro_crm_products
    SET display_id = public.next_display_id('PRD', r.owner_id, r.created_at)
    WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE public.pro_crm_services ALTER COLUMN display_id SET NOT NULL;
ALTER TABLE public.pro_crm_products ALTER COLUMN display_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_pro_crm_services_owner_display_id
  ON public.pro_crm_services(owner_id, display_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pro_crm_products_owner_display_id
  ON public.pro_crm_products(owner_id, display_id);

DROP TRIGGER IF EXISTS update_pro_crm_services_updated_at ON public.pro_crm_services;
CREATE TRIGGER update_pro_crm_services_updated_at
  BEFORE UPDATE ON public.pro_crm_services
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_pro_crm_products_updated_at ON public.pro_crm_products;
CREATE TRIGGER update_pro_crm_products_updated_at
  BEFORE UPDATE ON public.pro_crm_products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS tr_pro_crm_services_assign_display_id ON public.pro_crm_services;
CREATE TRIGGER tr_pro_crm_services_assign_display_id
  BEFORE INSERT ON public.pro_crm_services
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_display_id_trigger('SVC', 'owner_id');

DROP TRIGGER IF EXISTS tr_pro_crm_products_assign_display_id ON public.pro_crm_products;
CREATE TRIGGER tr_pro_crm_products_assign_display_id
  BEFORE INSERT ON public.pro_crm_products
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_display_id_trigger('PRD', 'owner_id');

ALTER TABLE public.pro_crm_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pro_crm_service_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pro_crm_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pro_crm_product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pro_crm_product_specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pro_crm_catalog_terms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Contractors manage own CRM services" ON public.pro_crm_services;
CREATE POLICY "Contractors manage own CRM services"
  ON public.pro_crm_services FOR ALL
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Contractors manage own CRM service images" ON public.pro_crm_service_images;
CREATE POLICY "Contractors manage own CRM service images"
  ON public.pro_crm_service_images FOR ALL
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Contractors manage own CRM products" ON public.pro_crm_products;
CREATE POLICY "Contractors manage own CRM products"
  ON public.pro_crm_products FOR ALL
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Contractors manage own CRM product images" ON public.pro_crm_product_images;
CREATE POLICY "Contractors manage own CRM product images"
  ON public.pro_crm_product_images FOR ALL
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Contractors manage own CRM product specs" ON public.pro_crm_product_specs;
CREATE POLICY "Contractors manage own CRM product specs"
  ON public.pro_crm_product_specs FOR ALL
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Contractors manage own CRM catalog terms" ON public.pro_crm_catalog_terms;
CREATE POLICY "Contractors manage own CRM catalog terms"
  ON public.pro_crm_catalog_terms FOR ALL
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pro_crm_services TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pro_crm_service_images TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pro_crm_products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pro_crm_product_images TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pro_crm_product_specs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pro_crm_catalog_terms TO authenticated;
GRANT ALL ON public.pro_crm_services TO service_role;
GRANT ALL ON public.pro_crm_service_images TO service_role;
GRANT ALL ON public.pro_crm_products TO service_role;
GRANT ALL ON public.pro_crm_product_images TO service_role;
GRANT ALL ON public.pro_crm_product_specs TO service_role;
GRANT ALL ON public.pro_crm_catalog_terms TO service_role;

INSERT INTO storage.buckets (id, name, public)
VALUES ('pro-crm-catalog', 'pro-crm-catalog', true)
ON CONFLICT (id) DO UPDATE SET public = excluded.public;

DROP POLICY IF EXISTS "pro_crm_catalog_public_read" ON storage.objects;
CREATE POLICY "pro_crm_catalog_public_read"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'pro-crm-catalog');

COMMENT ON TABLE public.pro_crm_services IS 'Contractor services for estimates. Price layout is flat, per unit, or a range.';
COMMENT ON TABLE public.pro_crm_products IS 'Contractor products. Shared retail columns plus spec rows for category-specific facts.';
