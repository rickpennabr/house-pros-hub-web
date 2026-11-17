-- Shared lock so only one instance answers a hub conversation at a time.
CREATE TABLE IF NOT EXISTS public.probot_hub_reply_locks (
  conversation_id UUID PRIMARY KEY
    REFERENCES public.probot_conversations(id) ON DELETE CASCADE,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE public.probot_hub_reply_locks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.probot_hub_reply_locks FROM PUBLIC, anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_probot_hub_reply_locks_expires
  ON public.probot_hub_reply_locks (expires_at);

CREATE OR REPLACE FUNCTION public.claim_hub_reply(
  p_conversation_id UUID,
  p_ttl_ms INTEGER DEFAULT 90000
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  now_ts TIMESTAMPTZ := now();
  ttl INTERVAL;
BEGIN
  IF p_conversation_id IS NULL OR p_ttl_ms IS NULL OR p_ttl_ms <= 0 THEN
    RAISE EXCEPTION 'invalid claim_hub_reply arguments';
  END IF;

  ttl := (p_ttl_ms || ' milliseconds')::interval;

  DELETE FROM public.probot_hub_reply_locks
  WHERE expires_at <= now_ts;

  BEGIN
    INSERT INTO public.probot_hub_reply_locks (conversation_id, locked_at, expires_at)
    VALUES (p_conversation_id, now_ts, now_ts + ttl);
    RETURN TRUE;
  EXCEPTION
    WHEN unique_violation THEN
      RETURN FALSE;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_hub_reply(p_conversation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_conversation_id IS NULL THEN
    RETURN;
  END IF;
  DELETE FROM public.probot_hub_reply_locks WHERE conversation_id = p_conversation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_hub_reply(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_hub_reply(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_hub_reply(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_hub_reply(UUID) TO service_role;

COMMENT ON TABLE public.probot_hub_reply_locks IS
  'Cross-instance lock while ProAgent answers a hub conversation.';
COMMENT ON FUNCTION public.claim_hub_reply(UUID, INTEGER) IS
  'Try to claim the hub reply lock. True if this caller owns it.';
COMMENT ON FUNCTION public.release_hub_reply(UUID) IS
  'Release the hub reply lock for a conversation.';
