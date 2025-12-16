import { SignupFormState } from '../hooks/useSignupForm';
import { USER_TYPES } from '@/lib/constants/auth';

export interface FieldErrors {
  [key: string]: string | undefined;
}

export function validateCurrentStep(
  formState: SignupFormState
): { isValid: boolean; fieldErrors: FieldErrors } {
  const { userType, currentStep } = formState;
  const fieldErrors: FieldErrors = {};

  if (userType === USER_TYPES.CUSTOMER) {
    if (currentStep === 1) {
      if (!formState.referral) {
        fieldErrors.referral = 'Please select how you heard about us';
      }
      if (formState.referral === 'Other' && !formState.referralOther.trim()) {
        fieldErrors.referralOther = 'Please enter how you heard about us';
      }
      if (!formState.firstName) {
        fieldErrors.firstName = 'First name is required';
      }
      if (!formState.lastName) {
        fieldErrors.lastName = 'Last name is required';
      }
    } else if (currentStep === 2) {
      // Check either streetAddress (from autocomplete selection) or address (from manual entry)
      const hasStreetAddress = formState.streetAddress.trim() || formState.address.trim();
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
      if (!formState.phone.trim()) {
        fieldErrors.phone = 'Phone is required';
      }
      if (!formState.email) {
        fieldErrors.email = 'Email is required';
      }
      if (!formState.password) {
        fieldErrors.password = 'Password is required';
      }
      if (!formState.confirmPassword) {
        fieldErrors.confirmPassword = 'Please confirm your password';
      } else if (formState.password !== formState.confirmPassword) {
        fieldErrors.confirmPassword = 'Passwords do not match';
      }
    }
  } else {
    // Contractor validation
    if (currentStep === 1) {
      if (!formState.referral) {
        fieldErrors.referral = 'Please select how you heard about us';
      }
      if (formState.referral === 'Other' && !formState.referralOther.trim()) {
        fieldErrors.referralOther = 'Please enter how you heard about us';
      }
      if (!formState.firstName) {
        fieldErrors.firstName = 'First name is required';
      }
      if (!formState.lastName) {
        fieldErrors.lastName = 'Last name is required';
      }
    } else if (currentStep === 2) {
      if (!formState.email) {
        fieldErrors.email = 'Email is required';
      }
      if (!formState.password) {
        fieldErrors.password = 'Password is required';
      }
      if (formState.password !== formState.confirmPassword) {
        fieldErrors.confirmPassword = 'Passwords do not match';
      }
      if (!formState.companyName) {
        fieldErrors.companyName = 'Company name is required';
      }
      // Validate licenses
      if (!formState.licenses || formState.licenses.length === 0) {
        fieldErrors.licenses = 'At least one license is required';
      } else {
        for (let i = 0; i < formState.licenses.length; i++) {
          const license = formState.licenses[i];
          if (!license.license) {
            fieldErrors[`license_${i}_license`] = `Please select a license classification for license ${i + 1}`;
          }
          if (!license.trade || !license.trade.trim()) {
            fieldErrors[`license_${i}_trade`] = `Please enter a license number for license ${i + 1}`;
          }
        }
      }
    } else if (currentStep === 3) {
      // Step 3 validation can be added here if needed
      // Currently no required fields for contractor step 3
    }
  }

  return { isValid: Object.keys(fieldErrors).length === 0, fieldErrors };
}

