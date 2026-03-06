-- Remove hub_agent: treat all existing hub_agent as probot, then restrict allowed values.
-- Only runs if admin_sent_as exists (migration 029 applied). Safe to run if 029 not yet applied.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'probot_messages' AND column_name = 'admin_sent_as'
  ) THEN
    UPDATE public.probot_messages SET admin_sent_as = 'probot' WHERE admin_sent_as = 'hub_agent';
    ALTER TABLE public.probot_messages DROP CONSTRAINT IF EXISTS probot_messages_admin_sent_as_check;
    ALTER TABLE public.probot_messages
      ADD CONSTRAINT probot_messages_admin_sent_as_check
      CHECK (admin_sent_as IS NULL OR admin_sent_as IN ('probot', 'business'));
    COMMENT ON COLUMN public.probot_messages.admin_sent_as IS 'For sender=admin: which identity the message was sent as. NULL or ''probot'' = ProBot. When ''business'', business_id identifies the business.';
  END IF;
END $$;
