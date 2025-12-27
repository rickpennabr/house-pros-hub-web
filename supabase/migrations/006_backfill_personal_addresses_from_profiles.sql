-- ============================================
-- Migration 006: Backfill personal addresses from legacy profile fields
-- ============================================
--
-- Goal:
-- - Make `addresses` the source of truth for personal addresses
-- - Backfill a `personal` address for users that have legacy profile address fields
-- - Avoid duplicates if a personal address already exists
--
-- Notes:
-- - This does NOT delete or modify legacy profile fields
-- - It only inserts missing `personal` addresses
--

INSERT INTO public.addresses (
  user_id,
  address_type,
  street_address,
  apartment,
  city,
  state,
  zip_code,
  gate_code,
  address_note,
  is_public,
  is_verified,
  created_at,
  updated_at
)
SELECT
  p.id AS user_id,
  'personal'::text AS address_type,
  NULLIF(p.street_address, '') AS street_address,
  NULLIF(p.apartment, '') AS apartment,
  NULLIF(p.city, '') AS city,
  NULLIF(p.state, '') AS state,
  NULLIF(p.zip_code, '') AS zip_code,
  NULLIF(p.gate_code, '') AS gate_code,
  NULLIF(p.address_note, '') AS address_note,
  false AS is_public,
  false AS is_verified,
  TIMEZONE('utc'::text, NOW()) AS created_at,
  TIMEZONE('utc'::text, NOW()) AS updated_at
FROM public.profiles p
LEFT JOIN public.addresses a
  ON a.user_id = p.id
 AND a.address_type = 'personal'
WHERE a.id IS NULL
  AND NULLIF(p.street_address, '') IS NOT NULL
  AND NULLIF(p.city, '') IS NOT NULL
  AND NULLIF(p.state, '') IS NOT NULL
  AND NULLIF(p.zip_code, '') IS NOT NULL;


