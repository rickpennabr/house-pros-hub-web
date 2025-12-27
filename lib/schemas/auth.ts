import { z } from 'zod';
import { LINK_TYPES } from '@/lib/constants/linkTypes';

const phoneRegex = /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/;
const zipRegex = /^\d{5}(-\d{4})?$/;

export const signupSchema = z.object({
  userType: z.enum(['customer', 'contractor']),
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().min(1, 'Last name is required'),
  email: z.string().trim().lowercase().email('Invalid email format').optional(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .optional(),
  confirmPassword: z.string().min(1, 'Please confirm your password').optional(),
  referral: z.string().min(1, 'Please select how you heard about us'),
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
  
  // Address fields (mostly for customer)
  streetAddress: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().length(2, 'Use 2-letter state code').default('NV').optional(),
  zipCode: z.string().trim().regex(zipRegex, 'Invalid ZIP code').optional().or(z.literal('')),
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
}).refine((data) => {
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
}).refine((data) => {
  if (data.referral === 'Other') {
    return !!data.referralOther?.trim();
  }
  return true;
}, {
  message: "Please enter how you heard about us",
  path: ["referralOther"],
}).refine((data) => {
  if (data.userType === 'customer' && !data.phone?.trim()) {
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
});

export type SignupSchema = z.infer<typeof signupSchema>;

/**
 * Schema for forgot password request
 * Validates email format
 */
export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email format'),
});

export type ForgotPasswordSchema = z.infer<typeof forgotPasswordSchema>;

/**
 * Schema for password reset
 * Validates password strength and confirmation match
 */
export const resetPasswordSchema = z.object({
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export type ResetPasswordSchema = z.infer<typeof resetPasswordSchema>;

