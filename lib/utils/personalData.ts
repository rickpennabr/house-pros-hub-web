import { User } from '@/contexts/AuthContext';

export interface PersonalData {
  address?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  apartment?: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
}

/**
 * Extract personal data from user object for use in forms
 * Used for "Same as Personal" functionality in business forms
 * @param user - User object from AuthContext
 * @returns PersonalData object with user's address and contact information
 */
export function extractPersonalData(user: User | null): PersonalData | undefined {
  if (!user) return undefined;

  return {
    address: user.streetAddress || '',
    streetAddress: user.streetAddress || '',
    city: user.city || '',
    state: user.state || '',
    zipCode: user.zipCode || '',
    apartment: user.apartment || '',
    email: user.email || '',
    phone: user.phone || '',
    mobilePhone: user.phone || '', // Using phone as fallback for mobilePhone
  };
}
