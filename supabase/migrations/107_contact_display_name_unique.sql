-- Display name is the name shown on lists, dropdowns, reports, and printed forms.
-- It is required and unique for a pro across customers, vendors, and employees.

UPDATE public.pro_crm_customers
SET display_name = NULLIF(
  btrim(
    COALESCE(
      NULLIF(btrim(display_name), ''),
      NULLIF(btrim(concat_ws(' ', first_name, last_name)), ''),
      NULLIF(btrim(company_name), ''),
      display_id
    )
  ),
  ''
)
WHERE display_name IS NULL OR btrim(display_name) = '';

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY owner_id, lower(btrim(display_name))
      ORDER BY created_at, id
    ) AS n
  FROM public.pro_crm_customers
  WHERE display_name IS NOT NULL AND btrim(display_name) <> ''
)
UPDATE public.pro_crm_customers AS contact
SET display_name = btrim(contact.display_name) || ' (' || contact.display_id || ')'
FROM ranked
WHERE contact.id = ranked.id
  AND ranked.n > 1;

CREATE UNIQUE INDEX IF NOT EXISTS pro_crm_customers_owner_display_name_key
  ON public.pro_crm_customers (owner_id, lower(btrim(display_name)))
  WHERE display_name IS NOT NULL AND btrim(display_name) <> '';

COMMENT ON COLUMN public.pro_crm_customers.display_name IS
  'Name shown on lists, dropdowns, reports, and printed forms. Unique for the pro.';
