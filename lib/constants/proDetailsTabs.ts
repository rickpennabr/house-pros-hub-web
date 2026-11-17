import {
  DEFAULT_BUSINESS_TAB_ORDER,
  normalizeBusinessTabOrder,
  type BusinessDetailsTab,
} from '@/lib/constants/businessTabs';

export type ProDetailsRole = 'contractor' | 'realtor' | 'installer' | 'handyman';

/** Pick the primary details layout when an account has more than one role. */
export function resolveProDetailsRole(roles: readonly string[]): ProDetailsRole {
  if (roles.includes('contractor')) return 'contractor';
  if (roles.includes('realtor')) return 'realtor';
  if (roles.includes('installer')) return 'installer';
  if (roles.includes('handyman')) return 'handyman';
  return 'contractor';
}

/** Default tab order for each pro role. Shared chrome stays consistent; middle tabs are role-specific. */
export function defaultTabsForRole(role: ProDetailsRole): BusinessDetailsTab[] {
  switch (role) {
    case 'realtor':
      return ['contact', 'hours', 'properties', 'links', 'images', 'about'];
    case 'installer':
      return ['contact', 'trades', 'products', 'links', 'images', 'about'];
    case 'handyman':
      return ['contact', 'hours', 'services', 'trades', 'links', 'images', 'about'];
    case 'contractor':
    default:
      return ['contact', 'hours', 'services', 'products', 'links', 'images', 'about'];
  }
}

export function roleAllowsTab(role: ProDetailsRole, tab: BusinessDetailsTab): boolean {
  return defaultTabsForRole(role).includes(tab);
}

/**
 * Merge a saved business tab_order with the role defaults.
 * Unknown/disallowed tabs for this role are dropped; missing allowed tabs are appended.
 */
export function normalizeTabsForRole(
  role: ProDetailsRole,
  savedOrder: unknown
): BusinessDetailsTab[] {
  const allowed = new Set(defaultTabsForRole(role));
  const fromSaved = normalizeBusinessTabOrder(savedOrder).filter((tab) => allowed.has(tab));
  const defaults = defaultTabsForRole(role);
  const order = [...fromSaved];
  for (const tab of defaults) {
    if (!order.includes(tab)) order.push(tab);
  }
  return order.length > 0 ? order : [...DEFAULT_BUSINESS_TAB_ORDER];
}
