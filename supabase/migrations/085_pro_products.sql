-- House Pros Hub product catalog. Separate from PavExpert Hub.
-- Public read is limited to published rows. Admin writes use the service role.

CREATE TABLE IF NOT EXISTS public.pro_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  brand text NOT NULL DEFAULT '',
  product_type text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  image_url text,
  published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pro_products_slug_key UNIQUE (slug)
);

CREATE INDEX IF NOT EXISTS pro_products_public_list_idx
  ON public.pro_products (name)
  WHERE published = true;

ALTER TABLE public.pro_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view published products" ON public.pro_products;
CREATE POLICY "Public can view published products"
  ON public.pro_products
  FOR SELECT
  TO anon, authenticated
  USING (published = true);

GRANT SELECT ON public.pro_products TO anon, authenticated;
GRANT ALL ON public.pro_products TO service_role;

DROP TRIGGER IF EXISTS update_pro_products_updated_at ON public.pro_products;
CREATE TRIGGER update_pro_products_updated_at
  BEFORE UPDATE ON public.pro_products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

INSERT INTO storage.buckets (id, name, public)
VALUES ('pro-product-images', 'pro-product-images', true)
ON CONFLICT (id) DO UPDATE SET public = excluded.public;

DROP POLICY IF EXISTS "pro_product_images_public_read" ON storage.objects;
CREATE POLICY "pro_product_images_public_read"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'pro-product-images');
