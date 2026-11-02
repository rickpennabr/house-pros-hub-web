/** Stored referral values. Labels are translated in the UI; these strings are what we save. */
export const REFERRAL_PREVIOUS_CUSTOMER = 'I am a previous customer';
export const REFERRAL_BY_PREVIOUS_CUSTOMER = 'Referred by a previous customer';
export const REFERRAL_BY_FRIEND = 'Referred by a friend';
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

const builtinNameOptions = new Set<string>([REFERRAL_BY_PREVIOUS_CUSTOMER, REFERRAL_BY_FRIEND]);
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
  if (referral === REFERRAL_BY_FRIEND) return 'referralFriendName';
  if (referral === REFERRAL_BY_PREVIOUS_CUSTOMER) return 'referralPreviousCustomerName';
  if (referralNeedsName(typeof referral === 'string' ? referral : '')) return 'referralName';
  return 'referralOther';
}
