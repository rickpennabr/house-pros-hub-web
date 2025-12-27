import { z } from 'zod';
import { LINK_TYPES } from '@/lib/constants/linkTypes';

const phoneRegex = /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/;
const zipRegex = /^\d{5}(-\d{4})?$/;

export const businessSchema = z.object({
  businessName: z.string().trim().min(1, 'Business name is required'),
  slug: z.string()
    .trim()
    .min(3, 'Slug must be at least 3 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
  companyDescription: z.string().trim().optional(),
  businessLogo: z.string().optional(),
  businessBackground: z.string().optional(),
  licenses: z.array(z.object({
    license: z.string().min(1, 'License classification is required'),
    licenseNumber: z.string().trim().min(1, 'License number is required'),
  })).min(1, 'At least one license is required'),
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

