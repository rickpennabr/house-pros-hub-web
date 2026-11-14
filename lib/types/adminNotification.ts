/** Bell events the admin header reads from admin_notification_events. */
export type AdminNotificationEventType =
  | 'signup'
  | 'deletion'
  | 'estimate'
  | 'estimate_accepted'
  | 'booking'
  | 'incoming_email'
  | 'maintenance';

export type AdminNotificationEntityType =
  | 'customer'
  | 'contractor'
  | 'realtor'
  | 'installer'
  | 'business'
  | 'estimate'
  | 'booking'
  | 'email';

export interface AdminBellEvent {
  eventType: AdminNotificationEventType;
  entityType: AdminNotificationEntityType;
  entityId: string;
  displayName: string;
  /** Extra line under the name in the bell (project, business, subject). */
  detail?: string | null;
}

export function adminNotificationHref(entityType: string, eventType?: string): string {
  if (eventType === 'estimate') return '/admin/estimates';
  if (eventType === 'maintenance') return '/admin';
  if (eventType === 'estimate_accepted') return '/admin';
  switch (entityType) {
    case 'customer':
      return '/admin/customers';
    case 'estimate':
      return '/admin/estimates';
    case 'business':
    case 'booking':
    case 'contractor':
      return '/admin/businesses';
    case 'realtor':
    case 'installer':
      return '/admin/users';
    default:
      return '/admin';
  }
}
