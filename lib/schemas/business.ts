import { z } from 'zod';
import { LINK_TYPES } from '@/lib/constants/linkTypes';
import { HANDYMAN_LICENSE_CODE } from '@/lib/constants/contractorLicenses';

const phoneRegex = /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/;
const zipRegex = /^\d{5}(-\d{4})?$/;

/** Nevada Business License (NV Business ID) is 11 digits. Spaces/dashes are stripped for validation. */
export const NEVADA_BUSINESS_LICENSE_DIGITS = 11;
export const NEVADA_BUSINESS_LICENSE_REGEX = /^\d{11}$/;

export function normalizeNevadaBusinessLicense(value: string): string {
  return value.replace(/\D/g, '');
}

export function isValidNevadaBusinessLicense(value: string): boolean {
  const digits = normalizeNevadaBusinessLicense(value);
  return digits.length === NEVADA_BUSINESS_LICENSE_DIGITS && NEVADA_BUSINESS_LICENSE_REGEX.test(digits);
}

const licenseItemSchema = z.object({
  license: z.string().min(1, 'License classification is required'),
  licenseNumber: z.string().trim().optional().default(''),
}).superRefine((data, ctx) => {
  // Only validate Nevada Business License format when Handyman and a value is provided
  if (data.license === HANDYMAN_LICENSE_CODE && (data.licenseNumber ?? '').trim()) {
    const digits = normalizeNevadaBusinessLicense(data.licenseNumber!);
    if (digits.length !== NEVADA_BUSINESS_LICENSE_DIGITS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Nevada Business License must be ${NEVADA_BUSINESS_LICENSE_DIGITS} digits (spaces or dashes are ignored)`,
        path: ['licenseNumber'],
      });
    }
  }
});

export const businessSchema = z.object({
  businessName: z.string().trim().min(1, 'Business name is required'),
  slug: z.string()
    .trim()
    .min(3, 'Slug must be at least 3 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
  companyDescription: z.string().trim().optional(),
  businessLogo: z.string().optional(),
  businessBackground: z.string().optional(),
  businessBackgroundPosition: z.string().optional(),
  licenses: z.array(licenseItemSchema).min(1, 'At least one license is required'),
  services: z.array(z.object({
    name: z.string().trim().min(1, 'Service name is required'),
  })).optional().default([]),
  images: z.array(z.string()).max(10, 'Maximum 10 images allowed').optional().default([]),
  streetAddress: z.string().trim().min(1, 'Street address is required'),
  city: z.string().trim().min(1, 'City is required'),
  state: z.string().trim().length(2, 'Use 2-letter state code').default('NV'),
  zipCode: z.string().trim().regex(zipRegex, 'Invalid ZIP code'),
  apartment: z.string().trim().optional(),
  address: z.string().trim().optional(), // Combined address string
  email: z.string().trim().lowercase().email('Invalid email format').optional().or(z.literal('')),
  phone: z.string().trim().regex(phoneRegex, 'Invalid phone format').optional().or(z.literal('')),
  mobilePhone: z.string().trim().regex(phoneRegex, 'Invalid phone format').optional().or(z.literal('')),
  links: z.array(z.object({
    type: z.enum(LINK_TYPES),
    url: z.string().optional().or(z.literal('')),
    value: z.string().optional().or(z.literal('')),
  })).optional().default([]),
}).refine((data) => {
  const hasPhone = !!data.phone?.trim();
  const hasMobilePhone = !!data.mobilePhone?.trim();
  return hasPhone || hasMobilePhone;
}, {
  message: 'At least one phone number is required',
  path: ['phone'],
});

export type BusinessSchema = z.infer<typeof businessSchema>;
// Use this for react-hook-form values (defaults allow undefined inputs, e.g. zod `.default()`)
export type BusinessFormValues = z.input<typeof businessSchema>;

