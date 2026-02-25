import { z } from 'zod';

const phoneRegex = /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/;
const zipRegex = /^\d{5}(-\d{4})?$/;

export const estimateSchema = z.object({
  // Customer Information
  firstName: z.string().trim().min(1, 'firstNameRequired'),
  lastName: z.string().trim().min(1, 'lastNameRequired'),
  email: z.string().trim().email('emailInvalid'),
  phone: z.string().trim().regex(phoneRegex, 'phoneInvalid'),
  
  // Address Information
  streetAddress: z.string().trim().min(1, 'streetAddressRequired'),
  city: z.string().trim().min(1, 'cityRequired'),
  state: z.string().trim().length(2, 'stateLength'),
  zipCode: z.string().trim().regex(zipRegex, 'zipInvalid'),
  apartment: z.string().trim().optional(),
  
  // Project Information
  projectType: z.enum(['new_construction', 'renovation', 'repair', 'remodel', 'other']).optional(),
  projectTypeOther: z.string().trim().optional(),
  requiresHoaApproval: z.boolean(),
  wants3D: z.boolean(),
  trades: z.array(z.string()).min(1, 'tradesMin'),
  projectDescription: z.string().trim(), // optional step: empty string allowed
  projectImages: z.array(z.string().url()).max(5, 'projectImagesMax').optional(),
  budgetRange: z.enum(['under_5k', '5k_10k', '10k_25k', '25k_50k', '50k_100k', 'over_100k', 'not_sure']).optional(),
  timeline: z.enum(['asap', 'within_month', '1_3_months', '3_6_months', '6_plus_months', 'flexible']).optional(),
  preferredContactMethod: z.enum(['phone', 'email', 'text', 'either']).optional(),
  additionalNotes: z.string().trim().optional(),
}).refine((data) => {
  // If projectType is 'other', projectTypeOther is required
  if (data.projectType === 'other') {
    return data.projectTypeOther && data.projectTypeOther.trim().length > 0;
  }
  return true;
}, {
  message: 'projectTypeOtherRequired',
  path: ['projectTypeOther'],
}).refine((data) => {
  // Ensure required enum fields are present
  return !!data.projectType;
}, {
  message: 'projectTypeRequired',
  path: ['projectType'],
}).refine((data) => {
  return !!data.budgetRange;
}, {
  message: 'budgetRangeRequired',
  path: ['budgetRange'],
}).refine((data) => {
  return !!data.timeline;
}, {
  message: 'timelineRequired',
  path: ['timeline'],
}).refine((data) => {
  return !!data.preferredContactMethod;
}, {
  message: 'preferredContactRequired',
  path: ['preferredContactMethod'],
});

export type EstimateSchema = z.infer<typeof estimateSchema>;
