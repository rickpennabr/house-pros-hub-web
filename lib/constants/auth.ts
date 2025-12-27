/**
 * Authentication-related constants
 */

export const USER_TYPES = {
  CUSTOMER: 'customer',
  CONTRACTOR: 'contractor',
} as const;

export type UserType = typeof USER_TYPES[keyof typeof USER_TYPES];

export const STORAGE_KEYS = {
  USER: 'auth_user',
  TOKEN: 'auth_token',
  // PASSWORDS removed - never store passwords in localStorage (security risk)
} as const;

