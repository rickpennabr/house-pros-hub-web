-- ============================================
-- Migration 016: Admin notification read timestamp
-- ============================================
-- Stores when the admin last marked "new signups" notifications as read.
-- Used so the badge count only shows signups after that time (within 24h window).

CREATE TABLE IF NOT EXISTS admin_notification_read (
  user_id UUID PRIMARY KEY,
  read_at TIMESTAMPTZ NOT NULL DEFAULT (TIMEZONE('utc'::text, NOW()))
);

-- Only backend (service role) reads/writes this; no RLS policies for app users.
COMMENT ON TABLE admin_notification_read IS 'Admin UI: last time notifications were marked read per admin user (user_id = auth user id).';
