import { isProSignup } from '@/lib/constants/auth';

/** Stored referral values. Labels are translated in the UI; these strings are what we save. */
export const REFERRAL_PREVIOUS_CUSTOMER = 'I am a previous customer';
export const REFERRAL_BY_PREVIOUS_CUSTOMER = 'Referred by a previous customer';
export const REFERRAL_BY_FRIEND = 'Referred by a friend';
/** Pro signup: the person types their friend's name in the follow-up field. */
export const REFERRAL_MY_FRIEND = 'My friend';
export const REFERRAL_OTHER = 'Other';

export const REFERRAL_OPTIONS = [
  'Google',
  'Instagram',
  'Facebook',
  REFERRAL_PREVIOUS_CUSTOMER,
  REFERRAL_BY_PREVIOUS_CUSTOMER,
  REFERRAL_BY_FRIEND,
  REFERRAL_OTHER,
] as const;

export type ReferralOption = (typeof REFERRAL_OPTIONS)[number];

const builtinNameOptions = new Set<string>([
  REFERRAL_BY_PREVIOUS_CUSTOMER,
  REFERRAL_BY_FRIEND,
  REFERRAL_MY_FRIEND,
]);
let customNameOptions = new Set<string>();

/** Names collected for admin-added options. Updated when those options load. */
export function setCustomNameOptions(labels: string[]) {
  customNameOptions = new Set(labels);
}

/** Options that ask for a person's name. The name is optional. */
export function referralNeedsName(referral: string | null | undefined): boolean {
  if (!referral) return false;
  return builtinNameOptions.has(referral) || customNameOptions.has(referral);
}

/** Options that show the extra text field (specify, or a name). */
export function referralNeedsDetail(referral: string | null | undefined): boolean {
  return referral === REFERRAL_OTHER || referralNeedsName(referral);
}

/** Chat follow-up prompt for the extra text step. */
export function referralFollowUpMessageKey(
  referral: unknown
): 'referralOther' | 'referralPreviousCustomerName' | 'referralFriendName' | 'referralName' {
  if (referral === REFERRAL_BY_FRIEND || referral === REFERRAL_MY_FRIEND) return 'referralFriendName';
  if (referral === REFERRAL_BY_PREVIOUS_CUSTOMER) return 'referralPreviousCustomerName';
  if (referralNeedsName(typeof referral === 'string' ? referral : '')) return 'referralName';
  return 'referralOther';
}

/** Chat bot prompt for the referral step. Pros are asked who invited them. */
export function signupReferralMessageKey(
  stepId: string,
  messageKey: string,
  referral: unknown,
  userType: unknown,
): string {
  if (stepId === 'referral' && isProSignup(userType)) return 'invitedBy';
  if (stepId === 'referralOther') {
    if (isProSignup(userType) && referral === REFERRAL_OTHER) return 'invitedByOther';
    return referralFollowUpMessageKey(referral);
  }
  return messageKey;
}

/** Other, and a pro's "My friend" choice, need the follow-up text before continuing. */
export function referralDetailRequired(
  referral: string | null | undefined,
  userType: unknown,
): boolean {
  if (referral === REFERRAL_OTHER) return true;
  return referral === REFERRAL_MY_FRIEND && isProSignup(userType);
}
