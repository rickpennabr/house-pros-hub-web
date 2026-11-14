-- One-off repair: attach today's gallery uploads. Earlier retries stayed in storage
-- because the images column did not exist, and the gallery cap is 30.
WITH ranked AS (
  SELECT
    name,
    created_at
  FROM storage.objects
  WHERE bucket_id = 'business-images'
    AND split_part(name, '/', 1) = 'e79fe48c-08f4-4928-9e69-17861b7edfe7'
    AND name LIKE '%/gallery-%'
    AND created_at >= '2026-11-13 23:50:00+00'
),
urls AS (
  SELECT jsonb_agg(
    to_jsonb(
      'https://pnwsavbxhbwhwyefccih.supabase.co/storage/v1/object/public/business-images/' || name
    )
    ORDER BY created_at
  ) AS images
  FROM ranked
)
UPDATE public.businesses
SET images = COALESCE((SELECT images FROM urls), '[]'::jsonb)
WHERE id = 'e79fe48c-08f4-4928-9e69-17861b7edfe7'
RETURNING jsonb_array_length(images) AS image_count;
