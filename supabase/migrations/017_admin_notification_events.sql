-- ============================================
-- Migration 017: Admin notification events (signup & deletion)
-- ============================================
-- Immutable log of signup and deletion events for admin notifications.
-- Notifications remain even after a user/business is deleted.

CREATE TABLE IF NOT EXISTS admin_notification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN ('signup', 'deletion')),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('customer', 'contractor')),
  entity_id UUID NOT NULL,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT (TIMEZONE('utc'::text, NOW()))
);

CREATE INDEX IF NOT EXISTS idx_admin_notification_events_created_at
  ON admin_notification_events (created_at DESC);

-- RLS: only backend (service role) should read/write; no policies for anon/authenticated = no access
ALTER TABLE admin_notification_events ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE admin_notification_events IS 'Admin UI: immutable log of signup and deletion events for notification badge and dropdown.';
