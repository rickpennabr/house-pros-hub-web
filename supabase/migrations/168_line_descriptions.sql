-- Saved line descriptions per product or service, for invoices and estimates.
-- A service's own description is for the pro page and bookings; on an invoice the line starts
-- empty, and every description the pro types there is saved here and offered again next time.

CREATE TABLE IF NOT EXISTS public.pro_crm_line_descriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL CHECK (char_length(item_name) BETWEEN 1 AND 200),
  -- lower(trim(item_name)) and lower(trim(description)): one row per wording, whatever the case.
  item_key TEXT NOT NULL,
  description TEXT NOT NULL CHECK (char_length(description) BETWEEN 1 AND 2000),
  description_key TEXT NOT NULL,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pro_crm_line_descriptions_unique UNIQUE (owner_id, item_key, description_key)
);

CREATE INDEX IF NOT EXISTS idx_pro_crm_line_descriptions_item
  ON public.pro_crm_line_descriptions (owner_id, item_key, last_used_at DESC);

ALTER TABLE public.pro_crm_line_descriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners manage their line descriptions" ON public.pro_crm_line_descriptions;
CREATE POLICY "Owners manage their line descriptions"
  ON public.pro_crm_line_descriptions
  FOR ALL
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pro_crm_line_descriptions TO authenticated;
GRANT ALL ON public.pro_crm_line_descriptions TO service_role;

-- Start with the descriptions already typed on invoices and estimates.
INSERT INTO public.pro_crm_line_descriptions (owner_id, item_name, item_key, description, description_key, last_used_at)
SELECT DISTINCT ON (owner_id, item_key, description_key)
  owner_id, item_name, item_key, description, description_key, used_at
FROM (
  SELECT
    doc.owner_id,
    trim(line->>'product_or_service') AS item_name,
    lower(trim(line->>'product_or_service')) AS item_key,
    left(trim(line->>'description'), 2000) AS description,
    lower(left(trim(line->>'description'), 2000)) AS description_key,
    doc.created_at AS used_at
  FROM (
    SELECT owner_id, line_items, created_at FROM public.pro_crm_invoices
    UNION ALL
    SELECT owner_id, line_items, created_at FROM public.pro_crm_estimates
  ) doc
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(doc.line_items) = 'array' THEN doc.line_items ELSE '[]'::jsonb END
  ) AS line
  WHERE coalesce(trim(line->>'product_or_service'), '') <> ''
    AND coalesce(trim(line->>'description'), '') <> ''
    AND line->>'expense_id' IS NULL
) found
WHERE char_length(item_name) <= 200
ORDER BY owner_id, item_key, description_key, used_at DESC
ON CONFLICT (owner_id, item_key, description_key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
