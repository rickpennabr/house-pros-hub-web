-- Re-add hub_agent to admin_sent_as and add admin_user_id for Hub Agent messages.
-- When admin_sent_as = 'hub_agent', admin_user_id identifies which admin sent the message (for profile picture).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'probot_messages' AND column_name = 'admin_sent_as'
  ) THEN
    ALTER TABLE public.probot_messages DROP CONSTRAINT IF EXISTS probot_messages_admin_sent_as_check;
    ALTER TABLE public.probot_messages
      ADD CONSTRAINT probot_messages_admin_sent_as_check
      CHECK (admin_sent_as IS NULL OR admin_sent_as IN ('probot', 'business', 'hub_agent'));
    COMMENT ON COLUMN public.probot_messages.admin_sent_as IS 'For sender=admin: which identity the message was sent as. NULL or ''probot'' = ProBot. ''business'' = business_id. ''hub_agent'' = admin as themselves (admin_user_id).';
  END IF;
END $$;

-- Store which admin user sent the message when admin_sent_as = 'hub_agent' (for showing that admin''s profile picture).
ALTER TABLE public.probot_messages
  ADD COLUMN IF NOT EXISTS admin_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.probot_messages.admin_user_id IS 'When sender=admin and admin_sent_as=hub_agent: the admin user who sent the message (for avatar/name).';
