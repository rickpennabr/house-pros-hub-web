import { BusinessFormState } from '../hooks/useAddBusinessForm';

export interface FieldErrors {
  [key: string]: string | undefined;
}

export function validateBusinessStep(
  formState: BusinessFormState
): { isValid: boolean; fieldErrors: FieldErrors } {
  const { currentStep } = formState;
  const fieldErrors: FieldErrors = {};

  if (currentStep === 1) {
    // Step 1: Business Name & Licenses
    if (!formState.businessName.trim()) {
      fieldErrors.businessName = 'Business name is required';
    }

    if (!formState.licenses || formState.licenses.length === 0) {
      fieldErrors.licenses = 'At least one license is required';
    } else {
      for (let i = 0; i < formState.licenses.length; i++) {
        const license = formState.licenses[i];
        if (!license.license) {
          fieldErrors[`license_${i}_license`] = `Please select a license classification for license ${i + 1}`;
        }
        if (!license.licenseNumber || !license.licenseNumber.trim()) {
          fieldErrors[`license_${i}_licenseNumber`] = `Please enter a license number for license ${i + 1}`;
        }
      }
    }
  } else if (currentStep === 2) {
    // Step 2: Address
    const hasStreetAddress =
      formState.streetAddress.trim() || formState.address.trim();
    if (!hasStreetAddress) {
      fieldErrors.streetAddress = 'Street address is required';
    }
    if (!formState.city.trim()) {
      fieldErrors.city = 'City is required';
    }
    if (!formState.state.trim()) {
      fieldErrors.state = 'State is required';
    }
    if (!formState.zipCode.trim()) {
      fieldErrors.zipCode = 'ZIP code is required';
    }
  } else if (currentStep === 3) {
    // Step 3: Contact (email is optional, but at least one phone is required)
    if (formState.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formState.email)) {
        fieldErrors.email = 'Invalid email format';
      }
    }
    
    // Require at least one phone (land phone or mobile phone)
    const hasPhone = formState.phone && formState.phone.trim();
    const hasMobilePhone = formState.mobilePhone && formState.mobilePhone.trim();
    
    if (!hasPhone && !hasMobilePhone) {
      fieldErrors.phone = 'At least one phone number (land phone or mobile phone) is required';
    }
    
    // Validate phone format if provided
    if (formState.phone && formState.phone.trim()) {
      const phoneDigits = formState.phone.replace(/\D/g, '');
      if (phoneDigits.length < 10) {
        fieldErrors.phone = 'Phone number must be at least 10 digits';
      }
    }
    
    // Validate mobile phone format if provided
    if (formState.mobilePhone && formState.mobilePhone.trim()) {
      const mobilePhoneDigits = formState.mobilePhone.replace(/\D/g, '');
      if (mobilePhoneDigits.length < 10) {
        fieldErrors.mobilePhone = 'Mobile phone number must be at least 10 digits';
      }
    }
  } else if (currentStep === 4) {
    // Step 4: Web Presence Links (all optional, but validate URLs if provided)
    if (formState.links && Array.isArray(formState.links)) {
      for (let i = 0; i < formState.links.length; i++) {
        const link = formState.links[i];
        if (link.url && link.url.trim()) {
          try {
            if (
              !link.url.startsWith('http://') &&
              !link.url.startsWith('https://')
            ) {
              fieldErrors[`link_${i}_url`] = `Invalid URL format for ${link.type}. URLs must start with http:// or https://`;
            } else {
              new URL(link.url);
            }
          } catch {
            fieldErrors[`link_${i}_url`] = `Invalid URL format for ${link.type}`;
          }
        }
      }
    }
  }

  return { isValid: Object.keys(fieldErrors).length === 0, fieldErrors };
}

