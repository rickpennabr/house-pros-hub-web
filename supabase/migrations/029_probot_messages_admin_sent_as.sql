-- Store which identity the admin used when sending (ProBot, HubAgent, or a business).
-- When NULL or missing, treat as 'hub_agent' for backward compatibility.
ALTER TABLE public.probot_messages
  ADD COLUMN IF NOT EXISTS admin_sent_as TEXT CHECK (admin_sent_as IN ('hub_agent', 'probot', 'business'));

COMMENT ON COLUMN public.probot_messages.admin_sent_as IS 'For sender=admin: which identity the message was sent as. NULL = hub_agent (legacy). When ''business'', business_id identifies the business.';
