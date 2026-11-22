/** Bell events the admin header reads from admin_notification_events. */
export type AdminNotificationEventType =
  | 'signup'
  | 'deletion'
  | 'estimate'
  | 'estimate_accepted'
  | 'booking'
  | 'incoming_email'
  | 'maintenance'
  /** A pro answered (or never answered) a job request the admin assigned. */
  | 'lead_accepted'
  | 'lead_declined'
  | 'lead_expired';

export type AdminNotificationEntityType =
  | 'customer'
  | 'contractor'
  | 'realtor'
  | 'installer'
  | 'handyman'
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
  if (eventType === 'estimate' || eventType?.startsWith('lead_')) return '/admin/estimates';
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
    case 'handyman':
      return '/admin/users';
    default:
      return '/admin';
  }
}
