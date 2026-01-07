import { z } from 'zod';
import { locales } from '@/i18n';

const phoneRegex = /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/;
const zipRegex = /^\d{5}(-\d{4})?$/;

/**
 * Schema for updating user profile
 * All fields are optional to support partial updates
 */
export const profileUpdateSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').optional(),
  lastName: z.string().trim().min(1, 'Last name is required').optional(),
  email: z.string().trim().lowercase().email('Invalid email format').optional(),
  phone: z.string()
    .trim()
    .regex(phoneRegex, 'Invalid phone format (e.g. 702-555-0123)')
    .or(z.literal(''))
    .optional(),
  referral: z.string().trim().optional(),
  referralOther: z.string().trim().optional(),
  streetAddress: z.string().trim().optional(),
  apartment: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().length(2, 'Use 2-letter state code').optional(),
  zipCode: z.string().trim().regex(zipRegex, 'Invalid ZIP code').or(z.literal('')).optional(),
  gateCode: z.string().trim().optional(),
  addressNote: z.string().trim().optional(),
  businessId: z.string().uuid('Invalid business ID format').optional().nullable(),
  companyRole: z.string().trim().optional(),
  companyRoleOther: z.string().trim().max(100, 'Company role must be less than 100 characters').optional(),
  userPicture: z.string().trim().optional(),
  preferredLocale: z.enum(locales).optional(),
}).refine((data) => {
  // If email is provided, it must be valid (already validated by zod)
  return true;
}).refine((data) => {
  // If referral is 'Other', referralOther must be provided
  if (data.referral === 'Other' && data.referralOther !== undefined) {
    return !!data.referralOther?.trim();
  }
  return true;
}, {
  message: 'Please enter how you heard about us',
  path: ['referralOther'],
}).refine((data) => {
  // If companyRole is 'Other', companyRoleOther must be provided
  if (data.companyRole === 'Other' && data.companyRoleOther !== undefined) {
    return !!data.companyRoleOther?.trim();
  }
  return true;
}, {
  message: 'Please enter your company role',
  path: ['companyRoleOther'],
});

export type ProfileUpdateSchema = z.infer<typeof profileUpdateSchema>;

