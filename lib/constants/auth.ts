/**
 * Authentication-related constants
 */

export const USER_TYPES = {
  CUSTOMER: 'customer',
  CONTRACTOR: 'contractor',
  REALTOR: 'realtor',
  INSTALLER: 'installer',
} as const;

export type UserType = typeof USER_TYPES[keyof typeof USER_TYPES];

/** Contractor, realtor, and installer signup. Customers stay on the original referral question. */
export function isProSignup(userType: unknown): boolean {
  return (
    userType === USER_TYPES.CONTRACTOR ||
    userType === USER_TYPES.REALTOR ||
    userType === USER_TYPES.INSTALLER
  );
}

/** Map the role chosen on the signup screen onto the form's user type. */
export function signupUserType(role: string | null | undefined): UserType {
  if (role === USER_TYPES.REALTOR) return USER_TYPES.REALTOR;
  if (role === USER_TYPES.INSTALLER) return USER_TYPES.INSTALLER;
  if (role === USER_TYPES.CONTRACTOR || role === 'both') return USER_TYPES.CONTRACTOR;
  return USER_TYPES.CUSTOMER;
}

export const STORAGE_KEYS = {
  USER: 'auth_user',
  TOKEN: 'auth_token',
  // PASSWORDS removed - never store passwords in localStorage (security risk)
} as const;

