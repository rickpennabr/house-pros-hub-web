-- Optional business_id on probot_messages: when set, message is directed to that pro (admin and pro receive).
ALTER TABLE public.probot_messages
  ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_probot_messages_business_id ON public.probot_messages(business_id) WHERE business_id IS NOT NULL;

COMMENT ON COLUMN public.probot_messages.business_id IS 'When set, visitor message is directed to this business (pro); admin sees all, pro sees their own.';
