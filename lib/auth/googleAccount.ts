/** How long after creation a password account is still treated as "just signed up". */
export const EXISTING_ACCOUNT_AGE_MS = 2 * 60 * 1000;

export type GoogleAccountKind = 'new' | 'existing';

export interface GoogleAccountSignals {
  userCreatedAt: string | null | undefined;
  providers: string[];
  hasRoles: boolean;
  /** Phone, referral, business, or a name already saved on the profile. */
  hasSavedProfile: boolean;
  now?: number;
}

/**
 * A Google sign-in that matches an existing email/password user must join that
 * account. Supabase links the identity when the email matches. This decides
 * whether our app should keep the saved profile or create a customer.
 */
export function classifyGoogleAccount(input: GoogleAccountSignals): GoogleAccountKind {
  if (input.hasRoles || input.hasSavedProfile) return 'existing';
  if (input.providers.includes('email')) return 'existing';

  const created = input.userCreatedAt ? Date.parse(input.userCreatedAt) : Number.NaN;
  const now = input.now ?? Date.now();
  if (Number.isFinite(created) && now - created > EXISTING_ACCOUNT_AGE_MS) return 'existing';

  return 'new';
}

/**
 * Supabase refused to finish Google sign-in because this email is already taken
 * and could not be linked. The person should use the password on that account.
 */
export function isGoogleAccountConflict(
  errorCode: string | null,
  errorDescription: string | null
): boolean {
  const code = (errorCode ?? '').toLowerCase();
  const description = (errorDescription ?? '').toLowerCase();
  return (
    code === 'email_exists' ||
    code === 'user_already_exists' ||
    code === 'identity_already_exists' ||
    description.includes('already registered') ||
    description.includes('already exists') ||
    description.includes('multiple accounts')
  );
}
