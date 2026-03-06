-- Chat presence: last_seen for visitors and admins (one row per visitor, one per admin).
-- Used to show online/offline in ProBot and admin chat.
-- Single unique "key" column (v:visitor_id or u:user_id) so upsert works without partial-index issues.

CREATE TABLE IF NOT EXISTS public.chat_presence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  visitor_id text,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_presence_one_identity CHECK (
    (visitor_id IS NOT NULL AND user_id IS NULL) OR
    (visitor_id IS NULL AND user_id IS NOT NULL)
  )
);

-- RLS: no direct client access; API uses service role
ALTER TABLE public.chat_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct client access to chat_presence"
  ON public.chat_presence FOR ALL
  USING (false);

COMMENT ON TABLE public.chat_presence IS 'Last-seen timestamps for ProBot visitors and admin users; used for online/offline indicators.';
