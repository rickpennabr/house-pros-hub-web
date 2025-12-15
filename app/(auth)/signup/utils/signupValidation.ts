import { SignupFormState } from '../hooks/useSignupForm';
import { USER_TYPES } from '@/lib/constants/auth';

export function validateCurrentStep(
  formState: SignupFormState
): { isValid: boolean; error: string | null } {
  const { userType, currentStep } = formState;

  if (userType === USER_TYPES.CUSTOMER) {
    if (currentStep === 1) {
      if (!formState.referral) {
        return { isValid: false, error: 'Please select how you heard about us' };
      }
      if (formState.referral === 'Other' && !formState.referralOther.trim()) {
        return { isValid: false, error: 'Please enter how you heard about us' };
      }
      if (!formState.firstName) {
        return { isValid: false, error: 'First name is required' };
      }
      if (!formState.lastName) {
        return { isValid: false, error: 'Last name is required' };
      }
    } else if (currentStep === 2) {
      // Check either streetAddress (from autocomplete selection) or address (from manual entry)
      const hasStreetAddress = formState.streetAddress.trim() || formState.address.trim();
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
      if (!formState.phone.trim()) {
        return { isValid: false, error: 'Phone is required' };
      }
      if (!formState.email) {
        return { isValid: false, error: 'Email is required' };
      }
      if (!formState.password) {
        return { isValid: false, error: 'Password is required' };
      }
      if (formState.password !== formState.confirmPassword) {
        return { isValid: false, error: 'Passwords do not match' };
      }
    }
  } else {
    // Contractor validation
    if (currentStep === 1) {
      if (!formState.referral) {
        return { isValid: false, error: 'Please select how you heard about us' };
      }
      if (formState.referral === 'Other' && !formState.referralOther.trim()) {
        return { isValid: false, error: 'Please enter how you heard about us' };
      }
      if (!formState.firstName) {
        return { isValid: false, error: 'First name is required' };
      }
      if (!formState.lastName) {
        return { isValid: false, error: 'Last name is required' };
      }
    } else if (currentStep === 2) {
      if (!formState.email) {
        return { isValid: false, error: 'Email is required' };
      }
      if (!formState.password) {
        return { isValid: false, error: 'Password is required' };
      }
      if (formState.password !== formState.confirmPassword) {
        return { isValid: false, error: 'Passwords do not match' };
      }
      if (!formState.companyName) {
        return { isValid: false, error: 'Company name is required' };
      }
      // Validate licenses
      if (!formState.licenses || formState.licenses.length === 0) {
        return { isValid: false, error: 'At least one license is required' };
      }
      for (let i = 0; i < formState.licenses.length; i++) {
        const license = formState.licenses[i];
        if (!license.license) {
          return { isValid: false, error: `Please select a license classification for license ${i + 1}` };
        }
        if (!license.trade || !license.trade.trim()) {
          return { isValid: false, error: `Please enter a license number for license ${i + 1}` };
        }
      }
    } else if (currentStep === 3) {
      // Step 3 validation can be added here if needed
      // Currently no required fields for contractor step 3
    }
  }

  return { isValid: true, error: null };
}

