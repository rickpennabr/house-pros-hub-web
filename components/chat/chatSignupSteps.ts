/**
 * Step definitions for conversational (Chatform-style) signup.
 * Each step shows one bot question and one input; order matches signup flow.
 */

export type ChatSignupStepId =
  | 'role'
  | 'userPicture'
  | 'firstName'
  | 'lastName'
  | 'referral'
  | 'referralOther'
  | 'address'
  | 'apartment'
  | 'gateCode'
  | 'addressNote'
  | 'phone'
  | 'email'
  | 'password'
  | 'confirmPassword'
  | 'agreeToTerms'
  | 'invitationCode';

export interface ChatSignupStep {
  id: ChatSignupStepId;
  /** Translation key for bot message (e.g. auth.signup.chat.role) */
  messageKey: string;
  /** Input type for the step */
  type: 'choice' | 'text' | 'email' | 'tel' | 'password' | 'upload' | 'address' | 'textarea' | 'checkbox';
  /** Optional: field name for form state (same as id for most) */
  field?: string;
  /** Optional: skip this step when condition is met (e.g. referralOther only when referral === 'Other') */
  skipWhen?: (values: Record<string, unknown>) => boolean;
}

export const CHAT_SIGNUP_STEPS: ChatSignupStep[] = [
  { id: 'role', messageKey: 'role', type: 'choice', field: 'userType' },
  { id: 'userPicture', messageKey: 'userPicture', type: 'upload', field: 'userPicture' },
  { id: 'firstName', messageKey: 'firstName', type: 'text', field: 'firstName' },
  { id: 'lastName', messageKey: 'lastName', type: 'text', field: 'lastName' },
  { id: 'referral', messageKey: 'referral', type: 'choice', field: 'referral' },
  { id: 'referralOther', messageKey: 'referralOther', type: 'text', field: 'referralOther', skipWhen: (v) => v.referral !== 'Other' },
  { id: 'address', messageKey: 'address', type: 'address', field: 'address' },
  { id: 'apartment', messageKey: 'apartment', type: 'text', field: 'apartment' },
  { id: 'gateCode', messageKey: 'gateCode', type: 'text', field: 'gateCode' },
  { id: 'addressNote', messageKey: 'addressNote', type: 'textarea', field: 'addressNote' },
  { id: 'phone', messageKey: 'phone', type: 'tel', field: 'phone' },
  { id: 'email', messageKey: 'email', type: 'email', field: 'email' },
  { id: 'password', messageKey: 'password', type: 'password', field: 'password' },
  { id: 'confirmPassword', messageKey: 'confirmPassword', type: 'password', field: 'confirmPassword' },
  { id: 'invitationCode', messageKey: 'invitationCode', type: 'text', field: 'invitationCode', skipWhen: (v) => v.userType !== 'contractor' },
  { id: 'agreeToTerms', messageKey: 'agreeToTerms', type: 'checkbox', field: 'agreeToTerms' },
];

export function getVisibleSteps(values: Record<string, unknown>): ChatSignupStep[] {
  return CHAT_SIGNUP_STEPS.filter((step) => !step.skipWhen?.(values));
}
