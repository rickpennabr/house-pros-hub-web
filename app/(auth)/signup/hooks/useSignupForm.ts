'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthRedirect } from '@/hooks/useAuthRedirect';
import { AddressData } from '@/components/AddressAutocomplete';
import { USER_TYPES, type UserType } from '@/lib/constants/auth';

export interface SignupFormState {
  // User type
  userType: UserType;
  
  // Personal info
  referral: string;
  referralOther: string;
  firstName: string;
  lastName: string;
  
  // Company info (contractor)
  companyName: string;
  companyRole: string;
  
  // Contact info
  email: string;
  password: string;
  confirmPassword: string;
  phone: string;
  locationPhone: string;
  mobilePhone: string;
  
  // Address info (customer)
  address: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  apartment: string;
  gateCode: string;
  addressNote: string;
  addressSelected: boolean;
  
  // Other
  licenses: Array<{ license: string; trade: string }>;
  selectedName: string;
  agreeToTerms: boolean;
  
  // UI state
  showPassword: boolean;
  showConfirmPassword: boolean;
  currentStep: number;
  error: string | null;
  isLoading: boolean;
  signupSuccess: boolean;
  showAddBusinessModal: boolean;
  showAddBusinessForm: boolean;
}

const initialState: SignupFormState = {
  userType: USER_TYPES.CUSTOMER,
  referral: '',
  referralOther: '',
  firstName: '',
  lastName: '',
  companyName: '',
  companyRole: '',
  email: '',
  password: '',
  confirmPassword: '',
  phone: '',
  locationPhone: '',
  mobilePhone: '',
  address: '',
  streetAddress: '',
  city: '',
  state: 'NV',
  zipCode: '',
  apartment: '',
  gateCode: '',
  addressNote: '',
  addressSelected: false,
  licenses: [{ license: '', trade: '' }],
  selectedName: '',
  agreeToTerms: false,
  showPassword: false,
  showConfirmPassword: false,
  currentStep: 1,
  error: null,
  isLoading: false,
  signupSuccess: false,
  showAddBusinessModal: false,
  showAddBusinessForm: false,
};

export function useSignupForm() {
  const router = useRouter();
  const { signup } = useAuth();
  const { redirectAfterAuth } = useAuthRedirect();
  const [formState, setFormState] = useState<SignupFormState>(initialState);

  // Reset step when user type changes
  useEffect(() => {
    setFormState(prev => ({
      ...prev,
      currentStep: 1,
      error: null,
      address: '',
      streetAddress: '',
      city: '',
      state: 'NV',
      zipCode: '',
      apartment: '',
      gateCode: '',
      addressNote: '',
      addressSelected: false,
    }));
  }, [formState.userType]);

  const updateField = <K extends keyof SignupFormState>(
    field: K,
    value: SignupFormState[K]
  ) => {
    setFormState(prev => ({ ...prev, [field]: value }));
  };

  const getTotalSteps = (): number => {
    return formState.userType === USER_TYPES.CONTRACTOR ? 4 : 3;
  };

  const getStepLabel = (): string => {
    if (formState.userType === USER_TYPES.CUSTOMER) {
      switch (formState.currentStep) {
        case 1:
          return 'Personal Information';
        case 2:
          return 'Address Information';
        case 3:
          return 'Credential Information';
        default:
          return '';
      }
    } else {
      switch (formState.currentStep) {
        case 1:
          return 'Personal Information';
        case 2:
          return 'Company Information';
        case 3:
          return 'Contact Information';
        case 4:
          return 'Terms & Conditions';
        default:
          return '';
      }
    }
  };

  const handleNext = () => {
    if (formState.currentStep < getTotalSteps()) {
      setFormState(prev => ({
        ...prev,
        currentStep: prev.currentStep + 1,
        error: null,
      }));
    }
  };

  const handlePrevious = () => {
    if (formState.currentStep > 1) {
      setFormState(prev => ({
        ...prev,
        currentStep: prev.currentStep - 1,
        error: null,
      }));
    }
  };

  const setError = (error: string | null) => {
    setFormState(prev => ({ ...prev, error }));
  };

  const handleAddressSelect = (addressData: AddressData) => {
    setFormState(prev => ({
      ...prev,
      streetAddress: addressData.streetAddress,
      city: addressData.city,
      state: addressData.state,
      zipCode: addressData.zipCode,
      apartment: '',
      addressSelected: true,
      address: addressData.streetAddress,
    }));
  };

  const handleAddressChange = (value: string) => {
    setFormState(prev => {
      if (!value) {
        return {
          ...prev,
          address: '',
          streetAddress: '',
          city: '',
          state: 'NV',
          zipCode: '',
          apartment: '',
          gateCode: '',
          addressNote: '',
          addressSelected: false,
        };
      }
      return { ...prev, address: value };
    });
  };

  const handleSignUp = async () => {
    setFormState(prev => ({ ...prev, error: null }));

    if (!formState.agreeToTerms) {
      setFormState(prev => ({
        ...prev,
        error: 'Please agree to the Terms of Service and Privacy Policy',
      }));
      return;
    }

    setFormState(prev => ({ ...prev, isLoading: true }));

    try {
      await signup({
        email: formState.email,
        password: formState.password,
        firstName: formState.firstName,
        lastName: formState.lastName,
        companyName: formState.companyName || undefined,
        companyRole: formState.companyRole || undefined,
      });

      setFormState(prev => ({ ...prev, signupSuccess: true, isLoading: false }));
    } catch (err) {
      setFormState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to create account. Please try again.',
      }));
    } finally {
      setFormState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const handleAddBusiness = () => {
    // Show modal first, then form
    setFormState(prev => ({ ...prev, showAddBusinessModal: true }));
  };

  const handleModalClose = () => {
    // After modal closes, show the form
    setFormState(prev => ({
      ...prev,
      showAddBusinessModal: false,
      showAddBusinessForm: true,
    }));
  };

  const handleBusinessFormClose = () => {
    setFormState(prev => ({
      ...prev,
      showAddBusinessForm: false,
    }));
  };

  // Get personal data for reuse in business form
  const getPersonalData = () => {
    return {
      address: formState.address,
      streetAddress: formState.streetAddress,
      city: formState.city,
      state: formState.state,
      zipCode: formState.zipCode,
      apartment: formState.apartment,
      email: formState.email,
      phone: formState.phone || formState.mobilePhone || formState.locationPhone,
    };
  };

  return {
    formState,
    updateField,
    setUserType: (userType: UserType) => updateField('userType', userType),
    setError,
    getTotalSteps,
    getStepLabel,
    handleNext,
    handlePrevious,
    handleAddressSelect,
    handleAddressChange,
    handleSignUp,
    handleAddBusiness,
    handleModalClose,
    handleBusinessFormClose,
    getPersonalData,
  };
}

