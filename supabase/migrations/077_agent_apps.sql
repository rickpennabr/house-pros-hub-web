-- Agent apps that may search pros and open estimate requests on behalf of a homeowner.
-- Keys are stored as a SHA-256 hash. The raw key is shown once when an admin creates the app.
-- Estimates record whether they came from the website or from one of these apps.

CREATE TABLE IF NOT EXISTS public.agent_apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT TIMEZONE('utc'::text, NOW()),
  revoked_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT agent_apps_name_length CHECK (char_length(btrim(name)) BETWEEN 1 AND 80)
);

CREATE INDEX IF NOT EXISTS idx_agent_apps_active
  ON public.agent_apps (created_at DESC)
  WHERE revoked_at IS NULL;

ALTER TABLE public.agent_apps ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.agent_apps IS
  'Registered AI agent apps. No policies: only the service role can read or write. Revoke by setting revoked_at.';

ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'web',
  ADD COLUMN IF NOT EXISTS agent_app_id UUID REFERENCES public.agent_apps(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'estimates_source_check'
  ) THEN
    ALTER TABLE public.estimates
      ADD CONSTRAINT estimates_source_check CHECK (source IN ('web', 'agent'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS estimates_agent_idempotency
  ON public.estimates (agent_app_id, idempotency_key)
  WHERE agent_app_id IS NOT NULL AND idempotency_key IS NOT NULL;

COMMENT ON COLUMN public.estimates.source IS 'web for the estimate form, agent for an API key or MCP tool call.';
COMMENT ON COLUMN public.estimates.agent_app_id IS 'Agent app that opened this request. Null for website submissions.';
COMMENT ON COLUMN public.estimates.idempotency_key IS 'Caller key so a retried agent request does not create a second estimate.';
