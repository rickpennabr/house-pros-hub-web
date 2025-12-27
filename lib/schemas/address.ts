import { z } from 'zod';

const zipRegex = /^\d{5}(-\d{4})?$/;

/**
 * Schema for address creation and updates
 */
export const addressSchema = z.object({
  addressType: z.enum(['personal', 'business'], {
    message: 'Address type must be either "personal" or "business"',
  }),
  streetAddress: z.string().trim().min(1, 'Street address is required'),
  apartment: z.string().trim().optional(),
  city: z.string().trim().min(1, 'City is required'),
  state: z.string().trim().length(2, 'State must be a 2-letter code').min(1, 'State is required'),
  zipCode: z.string().trim().regex(zipRegex, 'Invalid ZIP code format'),
  gateCode: z.string().trim().optional(),
  addressNote: z.string().trim().optional(),
  isPublic: z.boolean().optional().default(false),
});

/**
 * Schema for address updates (all fields optional except validation rules)
 */
export const addressUpdateSchema = addressSchema.partial().extend({
  addressType: z.enum(['personal', 'business']).optional(),
  streetAddress: z.string().trim().min(1, 'Street address is required').optional(),
  city: z.string().trim().min(1, 'City is required').optional(),
  state: z.string().trim().length(2, 'State must be a 2-letter code').optional(),
  zipCode: z.string().trim().regex(zipRegex, 'Invalid ZIP code format').optional(),
});

export type AddressSchema = z.infer<typeof addressSchema>;
export type AddressUpdateSchema = z.infer<typeof addressUpdateSchema>;

