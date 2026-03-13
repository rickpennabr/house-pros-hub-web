import { z } from 'zod';
import { US_PHONE_REGEX } from '@/lib/schemas/auth';

/**
 * Shared validation for CRM customer email and phone.
 * Matches signup form rules: same email format and US phone regex (NANP).
 * Use with validation.* message keys for i18n (e.g. validation.email.invalid).
 */

/** Validation key returned so UI can use tValidation(key). */
export type CustomerValidationErrorKey =
  | 'email.invalid'
  | 'phone.required'
  | 'phone.invalid'
  | null;

const emailSchema = z.string().trim().toLowerCase().email();

/**
 * Validate email. When empty, returns null (valid/optional).
 * When non-empty, must be valid email format.
 */
export function validateCustomerEmail(value: string): CustomerValidationErrorKey {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return emailSchema.safeParse(trimmed).success ? null : 'email.invalid';
}

/**
 * Validate phone. When empty and required=true, returns 'phone.required'.
 * When empty and required=false, returns null.
 * When non-empty, must match US phone format (same as signup).
 */
export function validateCustomerPhone(
  value: string,
  required: boolean
): CustomerValidationErrorKey {
  const trimmed = value.trim();
  if (!trimmed) return required ? 'phone.required' : null;
  const digitsOnly = trimmed.replace(/\D/g, '');
  const tenDigits = digitsOnly.length >= 10 ? digitsOnly.slice(-10) : digitsOnly;
  const toTest = tenDigits.length === 10 ? tenDigits : trimmed;
  return US_PHONE_REGEX.test(toTest) ? null : 'phone.invalid';
}
