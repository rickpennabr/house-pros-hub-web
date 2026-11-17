import type { UserRole } from '@/lib/utils/roles';

export type ProAccountRole = Exclude<UserRole, 'customer'>;

export const PRO_ACCOUNT_ROLES: ProAccountRole[] = [
  'contractor',
  'realtor',
  'installer',
  'handyman',
];

const ROLE_PRIORITY: ProAccountRole[] = [
  'contractor',
  'realtor',
  'installer',
  'handyman',
];

export function isProAccountRole(value: string | null | undefined): value is ProAccountRole {
  return !!value && (PRO_ACCOUNT_ROLES as string[]).includes(value);
}

/** Pick the public-facing pro role from an active roles list. */
export function primaryProAccountRole(roles: string[] | null | undefined): ProAccountRole | null {
  if (!roles?.length) return null;
  for (const role of ROLE_PRIORITY) {
    if (roles.includes(role)) return role;
  }
  return null;
}

export function proAccountRoleLabel(role: ProAccountRole | string | null | undefined): string {
  switch (role) {
    case 'contractor':
      return 'Contractor';
    case 'realtor':
      return 'Realtor';
    case 'installer':
      return 'Installer';
    case 'handyman':
      return 'Handyman';
    default:
      return '';
  }
}

/** Lucide icon name used under the business name on ProCard. */
export function proAccountRoleIcon(role: ProAccountRole | string | null | undefined): string {
  switch (role) {
    case 'contractor':
      return 'HardHat';
    case 'realtor':
      return 'Home';
    case 'installer':
      return 'Wrench';
    case 'handyman':
      return 'Hammer';
    default:
      return 'HardHat';
  }
}

/** Contractor and realtor upgrades need a one-time invitation code. */
export function roleRequiresInvitation(role: string | null | undefined): boolean {
  return role === 'contractor' || role === 'realtor';
}
