-- Add business (contractor) presence to chat_presence.
-- Key format: b:business_id. Used for ProBot sidebar contractor online/offline.

ALTER TABLE public.chat_presence
  ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE;

ALTER TABLE public.chat_presence
  DROP CONSTRAINT IF EXISTS chat_presence_one_identity;

ALTER TABLE public.chat_presence
  ADD CONSTRAINT chat_presence_one_identity CHECK (
    (visitor_id IS NOT NULL AND user_id IS NULL AND business_id IS NULL) OR
    (visitor_id IS NULL AND user_id IS NOT NULL AND business_id IS NULL) OR
    (visitor_id IS NULL AND user_id IS NULL AND business_id IS NOT NULL)
  );

COMMENT ON COLUMN public.chat_presence.business_id IS 'Set for contractor (business) presence; key = b:business_id.';
