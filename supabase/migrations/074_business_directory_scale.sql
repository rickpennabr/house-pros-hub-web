-- Directory scale: trigram search indexes and a paged filter function.
-- The public list used to load every active business into the browser.
-- Search and category filters now run in Postgres and return one page of ids.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_businesses_name_trgm
  ON public.businesses USING gin (business_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_businesses_description_trgm
  ON public.businesses USING gin (company_description gin_trgm_ops)
  WHERE company_description IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_businesses_services_trgm
  ON public.businesses USING gin ((COALESCE(services::text, '')) gin_trgm_ops);

-- Matches the public directory sort: active rows, admin order, then newest.
CREATE INDEX IF NOT EXISTS idx_businesses_active_directory
  ON public.businesses (display_order ASC NULLS LAST, created_at DESC)
  WHERE is_active = true;

CREATE OR REPLACE FUNCTION public.list_directory_business_ids(
  search text,
  license_types text[],
  category_name text,
  lim integer,
  off integer
)
RETURNS TABLE (id uuid, total_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH matched AS (
    SELECT b.id, b.display_order, b.created_at
    FROM public.businesses b
    WHERE b.is_active IS TRUE
      AND (
        search IS NULL
        OR btrim(search) = ''
        OR b.business_name ILIKE '%' || search || '%'
        OR COALESCE(b.company_description, '') ILIKE '%' || search || '%'
        OR COALESCE(b.services::text, '') ILIKE '%' || search || '%'
        OR EXISTS (
          SELECT 1
          FROM public.licenses l
          WHERE l.business_id = b.id
            AND (
              COALESCE(l.license_name, '') ILIKE '%' || search || '%'
              OR COALESCE(l.license_type, '') ILIKE '%' || search || '%'
            )
        )
      )
      AND (
        (
          (license_types IS NULL OR cardinality(license_types) = 0)
          AND (category_name IS NULL OR btrim(category_name) = '')
        )
        OR EXISTS (
          SELECT 1
          FROM public.licenses l
          WHERE l.business_id = b.id
            AND (
              (
                license_types IS NOT NULL
                AND cardinality(license_types) > 0
                AND l.license_type = ANY(license_types)
              )
              OR (
                category_name IS NOT NULL
                AND btrim(category_name) <> ''
                AND l.license_name ILIKE category_name
              )
            )
        )
      )
  ),
  counted AS (
    SELECT COUNT(*)::bigint AS total_count FROM matched
  )
  SELECT page.id, counted.total_count
  FROM counted
  LEFT JOIN LATERAL (
    SELECT m.id
    FROM matched m
    ORDER BY m.display_order ASC NULLS LAST, m.created_at DESC
    LIMIT GREATEST(COALESCE(lim, 0), 0)
    OFFSET GREATEST(COALESCE(off, 0), 0)
  ) page ON true;
$$;

REVOKE ALL ON FUNCTION public.list_directory_business_ids(text, text[], text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_directory_business_ids(text, text[], text, integer, integer) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.list_directory_business_ids IS
  'Paged ids of active businesses matching a directory search and/or category. Returns one null id row when the page is empty so total_count is still available.';
