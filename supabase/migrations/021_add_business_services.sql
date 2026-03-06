-- Add services column to businesses (array of service names for search/filter)
ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS services JSONB DEFAULT '[]';

COMMENT ON COLUMN businesses.services IS 'Array of service names offered by the business (e.g. ["Plumbing", "Repairs"])';
