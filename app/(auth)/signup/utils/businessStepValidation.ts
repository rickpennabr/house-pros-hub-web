import { BusinessFormState } from '../hooks/useAddBusinessForm';

export function validateBusinessStep(
  formState: BusinessFormState
): { isValid: boolean; error: string | null } {
  const { currentStep } = formState;

  if (currentStep === 1) {
    // Step 1: Business Name & Licenses
    if (!formState.businessName.trim()) {
      return { isValid: false, error: 'Business name is required' };
    }

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
  } else if (currentStep === 2) {
    // Step 2: Address
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
  } else if (currentStep === 3) {
    // Step 3: Contact (email and phone are optional but must be valid if provided)
    if (formState.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formState.email)) {
        return { isValid: false, error: 'Invalid email format' };
      }
    }
    if (formState.phone) {
      const phoneDigits = formState.phone.replace(/\D/g, '');
      if (phoneDigits.length < 10) {
        return {
          isValid: false,
          error: 'Phone number must be at least 10 digits',
        };
      }
    }
  } else if (currentStep === 4) {
    // Step 4: Web Presence Links (all optional, but validate URLs if provided)
    if (formState.links && Array.isArray(formState.links)) {
      for (const link of formState.links) {
        if (link.url && link.url.trim()) {
          try {
            if (
              !link.url.startsWith('http://') &&
              !link.url.startsWith('https://')
            ) {
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
    }
  }

  return { isValid: true, error: null };
}

