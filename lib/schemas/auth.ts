import { z } from 'zod';
import { LINK_TYPES } from '@/lib/constants/linkTypes';
import { isProSignup } from '@/lib/constants/auth';
import { REFERRAL_MY_FRIEND } from '@/lib/constants/referral';

/** US phone: 10 digits, optional formatting; area code must not start with 0 or 1 (NANP). */
export const US_PHONE_REGEX = /^\(?([2-9][0-9]{2})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/;
const phoneRegex = US_PHONE_REGEX;
const zipRegex = /^\d{5}(-\d{4})?$/;

/** Shared password validation: 8+ chars, one upper, one lower, one number. Used by signup and reset password. */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

const signupSchemaBaseObject = z.object({
  userType: z.enum(['customer', 'contractor', 'realtor', 'installer', 'handyman']),
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  email: z.string().trim().lowercase().email('Invalid email format').optional(),
  password: passwordSchema.optional(),
  confirmPassword: z.string().min(1, 'Please confirm your password').optional(),
  referral: z.string().min(1, 'Please select an option'),
  referralOther: z.string().trim().optional(),
  phone: z.string()
    .trim()
    .regex(phoneRegex, 'Invalid phone format (e.g. 702-555-0123)')
    .or(z.literal(''))
    .optional(),
  mobilePhone: z.string()
    .trim()
    .regex(phoneRegex, 'Invalid phone format')
    .or(z.literal(''))
    .optional(),
  userPicture: z.string().optional(),
  
  // Personal address is required for customer (and installer/handyman) signup.
  streetAddress: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional().or(z.literal('')),
  zipCode: z.string().trim().optional().or(z.literal('')),
  apartment: z.string().trim().optional(),
  gateCode: z.string().trim().optional(),
  addressNote: z.string().trim().optional(),
  address: z.string().trim().optional(), // Used for manual entry/autocomplete display

  // Contractor specific
  companyName: z.string().trim().optional(),
  companyRole: z.string().trim().optional(),
  companyRoleOther: z.string().trim().max(100, 'Company role must be less than 100 characters').optional(),
  licenses: z.array(z.object({
    license: z.string().optional(),
    trade: z.string().trim().optional(),
  })).optional(),
  links: z.array(z.object({
    type: z.enum(LINK_TYPES),
    url: z.string().optional().or(z.literal('')),
    value: z.string().optional().or(z.literal('')),
  })).optional(),
  agreeToTerms: z.boolean().refine(val => val === true, 'You must agree to the terms'),
  invitationCode: z.string().trim().optional(),
});

/** Base object schema (no refinements). Use for per-field validation e.g. in chat signup. */
export const signupSchemaBase = signupSchemaBaseObject;

export const signupSchema = signupSchemaBaseObject.refine((data) => {
  // Only validate password match if password is provided (not OAuth flow)
  if (data.password && data.confirmPassword) {
    return data.password === data.confirmPassword;
  }
  // If password is provided but confirmPassword is not, it's invalid
  if (data.password && !data.confirmPassword) {
    return false;
  }
  return true;
}, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
}).superRefine((data, ctx) => {
  if (data.referral === 'Other' && !data.referralOther?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: isProSignup(data.userType)
        ? 'Please enter who invited you'
        : 'Please enter how you heard about us',
      path: ['referralOther'],
    });
  }
  if (data.referral === REFERRAL_MY_FRIEND && isProSignup(data.userType) && !data.referralOther?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Please enter your friend's name",
      path: ['referralOther'],
    });
  }
}).refine((data) => {
  if ((data.userType === 'customer' || data.userType === 'installer' || data.userType === 'handyman') && !data.phone?.trim()) {
    return false;
  }
  return true;
}, {
  message: "Phone number is required",
  path: ["phone"],
}).refine((data) => {
  // If companyRole is 'Other', companyRoleOther must be provided
  if (data.companyRole === 'Other') {
    return !!data.companyRoleOther?.trim();
  }
  return true;
}, {
  message: "Please enter your company role",
  path: ["companyRoleOther"],
}).refine((data) => {
  if (data.userType === 'contractor' || data.userType === 'realtor' || data.userType === 'installer' || data.userType === 'handyman') {
    return !!data.invitationCode?.trim();
  }
  return true;
}, {
  message: 'Invitation code is required for this signup.',
  path: ['invitationCode'],
}).superRefine((data, ctx) => {
  const street = data.streetAddress?.trim() ?? '';
  const city = data.city?.trim() ?? '';
  const zip = data.zipCode?.trim() ?? '';
  const state = data.state?.trim() ?? '';
  const needsAddress =
    data.userType === 'customer' ||
    data.userType === 'installer' ||
    data.userType === 'handyman';

  if (!needsAddress) {
    if (!street && !city && !zip) return;
    if (!street) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Street address is required when you add an address',
        path: ['streetAddress'],
      });
    }
    if (!city) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'City is required when you add an address',
        path: ['city'],
      });
    }
    if (state.length !== 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Use a 2-letter state code', path: ['state'] });
    }
    if (!zipRegex.test(zip)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid ZIP code', path: ['zipCode'] });
    }
    return;
  }

  if (!street) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Street address is required',
      path: ['streetAddress'],
    });
  }
  if (!city) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'City is required', path: ['city'] });
  }
  if (state.length !== 2) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Use a 2-letter state code', path: ['state'] });
  }
  if (!zipRegex.test(zip)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid ZIP code', path: ['zipCode'] });
  }
});

export type SignupSchema = z.infer<typeof signupSchema>;

