-- ============================================
-- Migration 019: RLS for admin_notification_read
-- ============================================
-- Enable RLS so that direct DB access (anon/authenticated) is restricted.
-- Only admins (in admin_users) can access their own row. API uses service role and bypasses RLS.

ALTER TABLE public.admin_notification_read ENABLE ROW LEVEL SECURITY;

-- Admins can read/insert/update/delete only their own notification read timestamp.
CREATE POLICY "Admins can manage own notification read"
  ON public.admin_notification_read
  FOR ALL
  USING (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid())
  );
