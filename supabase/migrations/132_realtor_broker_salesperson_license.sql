-- Nevada Real Estate Division issues three license levels under NRS 645:
-- Salesperson (S.), Broker-salesperson (BS.), and Broker (B.).
-- Broker-salesperson was missing from the realtor license categories.

INSERT INTO public.license_categories (code, name, description, requires_contractor_license, sort_order, role)
VALUES
  (
    'REALTOR_BROKER_SALES',
    'Real Estate Broker-Salesperson',
    'Nevada broker-salesperson license (broker-qualified, works under another broker). License numbers use the BS. prefix.',
    false,
    1,
    'realtor'
  )
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  requires_contractor_license = EXCLUDED.requires_contractor_license,
  sort_order = EXCLUDED.sort_order,
  role = EXCLUDED.role;

-- Keep broker after broker-salesperson in the list.
UPDATE public.license_categories
SET sort_order = 2
WHERE code = 'REALTOR_BROKER' AND role = 'realtor';

UPDATE public.license_categories
SET
  description = 'Nevada real estate salesperson license. License numbers use the S. prefix (example: S.12345).'
WHERE code = 'REALTOR_SALES' AND role = 'realtor';

UPDATE public.license_categories
SET
  description = 'Nevada real estate broker license. License numbers use the B. prefix (example: B.12345). A broker can own or run a brokerage.'
WHERE code = 'REALTOR_BROKER' AND role = 'realtor';
