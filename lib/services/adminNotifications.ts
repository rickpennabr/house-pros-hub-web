import { createServiceRoleClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import type { AdminBellEvent, AdminNotificationEntityType } from '@/lib/types/adminNotification';

export type { AdminBellEvent, AdminNotificationEntityType, AdminNotificationEventType } from '@/lib/types/adminNotification';
export { adminNotificationHref } from '@/lib/types/adminNotification';

const LEGACY_ENTITY = new Set<AdminNotificationEntityType>(['customer', 'contractor']);

/**
 * Persist an admin bell item. Email is sent by the caller.
 * Fails open: a missing migration must not block the user action.
 */
export async function recordAdminBellEvent(event: AdminBellEvent): Promise<void> {
  const service = createServiceRoleClient();
  const base = {
    event_type: event.eventType,
    entity_type: event.entityType,
    entity_id: event.entityId,
    display_name: event.displayName.trim() || 'Unknown',
  };
  const detail = event.detail?.trim();
  const withDetail = detail ? { ...base, detail } : base;

  let { error } = await service.from('admin_notification_events').insert(withDetail);

  const missingDetail = Boolean(error && (error.code === '42703' || /detail/i.test(error.message)));
  if (missingDetail) {
    ({ error } = await service.from('admin_notification_events').insert(base));
  }

  // Realtor and installer need migration 096. Until then, show the signup as a contractor.
  if (error?.code === '23514' && event.eventType === 'signup' && !LEGACY_ENTITY.has(event.entityType)) {
    ({ error } = await service.from('admin_notification_events').insert({
      ...base,
      entity_type: 'contractor',
    }));
  }

  if (!error) return;

  logger.warn('Failed to log admin notification event', {
    endpoint: 'admin-notifications',
    eventType: event.eventType,
    entityType: event.entityType,
    error: error.message,
    hint:
      error.code === '23514' || missingDetail
        ? 'Apply supabase/migrations/096_admin_notification_platform_events.sql'
        : undefined,
  });
}
