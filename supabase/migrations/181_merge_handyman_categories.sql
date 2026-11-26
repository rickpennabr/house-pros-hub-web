-- One handyman category: "Handyman Interior" and "Handyman Exterior" merge into HANDYMAN, shown as "Handymen".
-- Businesses that had either one keep a handyman license (moved to HANDYMAN).
UPDATE public.licenses
SET license_type = 'HANDYMAN'
WHERE license_type <> 'HANDYMAN'
  AND upper(replace(license_type, '_', ' ')) IN ('HANDYMAN INTERIOR', 'HANDYMAN EXTERIOR');

DELETE FROM public.license_categories
WHERE code <> 'HANDYMAN'
  AND upper(replace(code, '_', ' ')) IN ('HANDYMAN INTERIOR', 'HANDYMAN EXTERIOR');

UPDATE public.license_categories
SET name = 'Handymen', updated_at = now()
WHERE code = 'HANDYMAN';
