import { BusinessFormState } from '../hooks/useAddBusinessForm';
import { isValidEmail } from '@/lib/validation';

export function validateBusinessForm(
  formState: BusinessFormState
): { isValid: boolean; error: string | null } {
  // Validate business name
  if (!formState.businessName.trim()) {
    return { isValid: false, error: 'Business name is required' };
  }

  // Validate licenses
  if (!formState.licenses || formState.licenses.length === 0) {
    return { isValid: false, error: 'At least one license is required' };
  }

  for (let i = 0; i < formState.licenses.length; i++) {
    const license = formState.licenses[i];
    if (!license.license) {
      return {
        isValid: false,
        error: `Please select a license classification for license ${i + 1}`,
      };
    }
    if (!license.licenseNumber || !license.licenseNumber.trim()) {
      return {
        isValid: false,
        error: `Please enter a license number for license ${i + 1}`,
      };
    }
  }

  // Validate address
  const hasStreetAddress =
    formState.streetAddress.trim() || formState.address.trim();
  if (!hasStreetAddress) {
    return { isValid: false, error: 'Street address is required' };
  }
  if (!formState.city.trim()) {
    return { isValid: false, error: 'City is required' };
  }
  if (!formState.state.trim()) {
    return { isValid: false, error: 'State is required' };
  }
  if (!formState.zipCode.trim()) {
    return { isValid: false, error: 'ZIP code is required' };
  }

  // Validate email format if provided
  if (formState.email && !isValidEmail(formState.email)) {
    return { isValid: false, error: 'Invalid email format' };
  }

  // Validate phone if provided (basic check - at least 10 digits)
  if (formState.phone) {
    const phoneDigits = formState.phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      return { isValid: false, error: 'Phone number must be at least 10 digits' };
    }
  }

  // Validate link URLs if provided
  for (const link of formState.links) {
    if (link.url && link.url.trim()) {
      try {
        // Basic URL validation
        if (!link.url.startsWith('http://') && !link.url.startsWith('https://')) {
          return {
            isValid: false,
            error: `Invalid URL format for ${link.type}. URLs must start with http:// or https://`,
          };
        }
        new URL(link.url);
      } catch {
        return {
          isValid: false,
          error: `Invalid URL format for ${link.type}`,
        };
      }
    }
  }

  return { isValid: true, error: null };
}

