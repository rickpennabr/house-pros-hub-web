'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, type User } from '@/contexts/AuthContext';
import { AddressData } from '@/components/AddressAutocomplete';
import { USER_TYPES, type UserType } from '@/lib/constants/auth';
import { authStorage } from '@/lib/storage/authStorage';

export interface SignupFormState {
  // User type
  userType: UserType;
  
  // Personal info
  userPicture: string | null;
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
  successMessage: string | null;
  fieldErrors: { [key: string]: string | undefined };
  isLoading: boolean;
  showAddBusinessModal: boolean;
  showAddBusinessForm: boolean;
  businessSuccessMessage: string | null;
  
  // Authentication backup - store user after successful signup
  signedUpUser: User | null;
}

const initialState: SignupFormState = {
  userType: USER_TYPES.CUSTOMER,
  userPicture: null,
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
  successMessage: null,
  fieldErrors: {},
  isLoading: false,
  showAddBusinessModal: false,
  showAddBusinessForm: false,
  businessSuccessMessage: null,
  signedUpUser: null,
};

export function useSignupForm() {
  const router = useRouter();
  const { signup, checkAuth, user, isAuthenticated } = useAuth();
  const [formState, setFormState] = useState<SignupFormState>(initialState);
  
  // Use ref as additional backup - persists across re-renders and doesn't get cleared
  // This is the most reliable storage mechanism
  const signedUpUserRef = useRef<User | null>(null);

  // Reset step when user type changes
  useEffect(() => {
    setFormState(prev => ({
      ...prev,
      currentStep: 1,
      error: null,
      fieldErrors: {},
      userPicture: null,
      address: '',
      streetAddress: '',
      city: '',
      state: 'NV',
      zipCode: '',
      apartment: '',
      gateCode: '',
      addressNote: '',
      addressSelected: false,
      signedUpUser: null, // Clear signed up user when switching user types
    }));
  }, [formState.userType]);

  const updateField = <K extends keyof SignupFormState>(
    field: K,
    value: SignupFormState[K]
  ) => {
    setFormState(prev => {
      const newState = { ...prev, [field]: value };
      // Clear field error when user starts typing
      if (prev.fieldErrors[field as string]) {
        const { [field as string]: _, ...restErrors } = prev.fieldErrors;
        newState.fieldErrors = restErrors;
      }
      return newState;
    });
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
        fieldErrors: {},
      }));
    }
  };

  const handlePrevious = () => {
    if (formState.currentStep > 1) {
      setFormState(prev => ({
        ...prev,
        currentStep: prev.currentStep - 1,
        error: null,
        fieldErrors: {},
      }));
    }
  };

  const setError = (error: string | null) => {
    setFormState(prev => ({ ...prev, error }));
  };

  const setFieldErrors = (fieldErrors: { [key: string]: string | undefined }) => {
    setFormState(prev => ({ ...prev, fieldErrors }));
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
      // signup() returns the created user - capture it immediately
      console.log('🔵 [handleSignUp] Starting signup process...');
      const createdUser = await signup({
        email: formState.email,
        password: formState.password,
        firstName: formState.firstName,
        lastName: formState.lastName,
        phone: formState.phone || undefined,
        referral: formState.referral || undefined,
        referralOther: formState.referralOther || undefined,
        streetAddress: formState.streetAddress || undefined,
        apartment: formState.apartment || undefined,
        city: formState.city || undefined,
        state: formState.state || undefined,
        zipCode: formState.zipCode || undefined,
        gateCode: formState.gateCode || undefined,
        addressNote: formState.addressNote || undefined,
        companyName: formState.companyName || undefined,
        companyRole: formState.companyRole || undefined,
        userPicture: formState.userPicture || undefined,
      });

      console.log('✅ [handleSignUp] Signup completed, user created:', {
        userId: createdUser.id,
        userEmail: createdUser.email,
      });

      // Verify user is stored in localStorage (defensive check)
      const storedUser = authStorage.getUser();
      const storedToken = authStorage.getToken();
      
      console.log('🔵 [handleSignUp] Verifying storage:', {
        hasStoredUser: !!storedUser,
        hasStoredToken: !!storedToken,
        storedUserId: storedUser?.id,
        createdUserId: createdUser.id,
        match: storedUser?.id === createdUser.id,
      });

      // If user is missing or doesn't match, re-store it (recovery)
      if (!storedUser || storedUser.id !== createdUser.id) {
        console.warn('⚠️ [handleSignUp] User missing or mismatch in localStorage, re-storing...');
        authStorage.setUser(createdUser);
        if (!storedToken) {
          // Generate token if missing
          const mockToken = `mock_jwt_${Date.now()}_${Math.random().toString(36).substring(7)}`;
          authStorage.setToken(mockToken);
          console.log('🔵 [handleSignUp] Generated and stored new token');
        }
      }

      // Explicitly sync auth state to ensure React context is updated
      console.log('🔵 [handleSignUp] Syncing auth state with checkAuth()...');
      await checkAuth();

      // Verify again after checkAuth
      const verifiedUser = authStorage.getUser();
      if (!verifiedUser || verifiedUser.id !== createdUser.id) {
        console.warn('⚠️ [handleSignUp] User still missing after checkAuth, re-storing from createdUser...');
        authStorage.setUser(createdUser);
      }

      // Store user in multiple places for maximum reliability
      console.log('✅ [handleSignUp] Storing user in multiple locations...');
      
      // 1. Store in formState (React state)
      setFormState(prev => ({
        ...prev,
        successMessage: 'Thanks for signing up for House Pros Hub! Now you can contact your pro. But if you are an invited contractor, feel free to create a business account.',
        signedUpUser: createdUser, // Backup 1: React state
        error: null, // Clear any errors when showing success
        fieldErrors: {}, // Clear field errors
      }));
      
      // 2. Store in ref (persists across re-renders, most reliable)
      signedUpUserRef.current = createdUser;
      console.log('✅ [handleSignUp] User stored in:', {
        formState: true,
        ref: true,
        localStorage: !!authStorage.getUser(),
        context: !!user,
      });

      console.log('✅ [handleSignUp] Signup process complete, success screen should show');
    } catch (err) {
      setFormState(prev => ({
        ...prev,
        error: err instanceof Error ? err.message : 'Failed to create account. Please try again.',
      }));
    } finally {
      setFormState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const handleAddBusiness = async () => {
    console.log('🔵 [handleAddBusiness] Called - Starting...');
    console.log('🔵 [handleAddBusiness] Current formState:', {
      successMessage: formState.successMessage,
      showAddBusinessModal: formState.showAddBusinessModal,
      showAddBusinessForm: formState.showAddBusinessForm,
      currentStep: formState.currentStep,
      hasSignedUpUser: !!formState.signedUpUser,
    });

    try {
      // MULTI-LAYER DEFENSE: Check multiple sources in priority order
      
      // Priority 1: Check ref (most reliable - persists across re-renders)
      let currentUser: User | null = signedUpUserRef.current;
      console.log('🔵 [handleAddBusiness] Priority 1 - signedUpUserRef:', {
        hasUser: !!currentUser,
        userId: currentUser?.id,
        userEmail: currentUser?.email,
      });
      
      // Priority 2: Check formState.signedUpUser (React state backup)
      if (!currentUser || !currentUser.id) {
        currentUser = formState.signedUpUser;
        console.log('🔵 [handleAddBusiness] Priority 2 - formState.signedUpUser:', {
          hasUser: !!currentUser,
          userId: currentUser?.id,
          userEmail: currentUser?.email,
        });
      }

      // Priority 3: Check localStorage (persistent storage)
      if (!currentUser || !currentUser.id) {
        const storedUser = authStorage.getUser();
        const storedToken = authStorage.getToken();
        
        console.log('🔵 [handleAddBusiness] Priority 3 - localStorage:', {
          hasStoredUser: !!storedUser,
          hasStoredToken: !!storedToken,
          storedUserId: storedUser?.id,
        });
        
        currentUser = storedUser;
      }

      // Priority 4: Check React context (UI state)
      if (!currentUser || !currentUser.id) {
        console.log('🔵 [handleAddBusiness] Priority 4 - React context:', {
          hasContextUser: !!user,
          contextUserId: user?.id,
          isAuthenticated,
        });
        
        currentUser = user;
      }

      // Priority 5: Try syncing with checkAuth if still not found
      if (!currentUser || !currentUser.id) {
        console.log('🔵 [handleAddBusiness] Priority 5 - Calling checkAuth() to sync...');
        await checkAuth();
        
        // Check all sources again after sync (in priority order)
        currentUser = signedUpUserRef.current || formState.signedUpUser || authStorage.getUser() || user;
        
        console.log('🔵 [handleAddBusiness] After checkAuth sync:', {
          hasRefUser: !!signedUpUserRef.current,
          hasFormStateUser: !!formState.signedUpUser,
          hasLocalStorageUser: !!authStorage.getUser(),
          hasContextUser: !!user,
          finalUser: !!currentUser,
        });
      }

      // RECOVERY: If user is still missing, try to restore from formState data
      if (!currentUser || !currentUser.id) {
        console.error('❌ [handleAddBusiness] No user found in any source');
        console.log('🔵 [handleAddBusiness] Full debug info:', {
          refUser: signedUpUserRef.current,
          formStateSignedUpUser: formState.signedUpUser,
          localStorageUser: authStorage.getUser(),
          localStorageToken: authStorage.getToken(),
          contextUser: user,
          successMessage: formState.successMessage,
          formStateEmail: formState.email,
          formStateFirstName: formState.firstName,
        });

        // Recovery attempt: If we have form data, we could reconstruct, but it's better to show error
        if (formState.successMessage && formState.email) {
          setFormState(prev => ({
            ...prev,
            error: 'Authentication data was lost. Please refresh the page and sign in again, or try signing up again.',
          }));
        } else {
          setFormState(prev => ({
            ...prev,
            error: 'You must be logged in to create a business. Please complete the signup process first.',
          }));
        }
        return;
      }

      // RECOVERY: Ensure user is stored in all locations
      const storedUser = authStorage.getUser();
      if (!storedUser || storedUser.id !== currentUser.id) {
        console.warn('⚠️ [handleAddBusiness] User not in localStorage, re-storing...');
        authStorage.setUser(currentUser);
        
        // Ensure token exists
        const storedToken = authStorage.getToken();
        if (!storedToken) {
          const mockToken = `mock_jwt_${Date.now()}_${Math.random().toString(36).substring(7)}`;
          authStorage.setToken(mockToken);
          console.log('🔵 [handleAddBusiness] Generated and stored new token');
        }
      }
      
      // Also ensure user is in ref and formState (recovery)
      if (!signedUpUserRef.current || signedUpUserRef.current.id !== currentUser.id) {
        signedUpUserRef.current = currentUser;
        console.log('🔵 [handleAddBusiness] Stored user in ref');
      }
      
      if (!formState.signedUpUser || formState.signedUpUser.id !== currentUser.id) {
        setFormState(prev => ({
          ...prev,
          signedUpUser: currentUser,
        }));
        console.log('🔵 [handleAddBusiness] Stored user in formState');
      }

      // User is authenticated - show form directly
      console.log('✅ [handleAddBusiness] User authenticated:', {
        userId: currentUser.id,
        userEmail: currentUser.email,
        source: formState.signedUpUser?.id === currentUser.id ? 'formState' : 
                authStorage.getUser()?.id === currentUser.id ? 'localStorage' : 'context',
      });
      console.log('✅ [handleAddBusiness] Showing form directly...');
      
      setFormState(prev => {
        const newState = { 
          ...prev, 
          showAddBusinessForm: true,
          businessSuccessMessage: null, // Clear business success message when opening form
        };
        console.log('🔵 [handleAddBusiness] State updated:', {
          showAddBusinessForm: newState.showAddBusinessForm,
        });
        return newState;
      });
      
      console.log('✅ [handleAddBusiness] Complete - Form should be visible');
    } catch (error) {
      console.error('❌ [handleAddBusiness] Error occurred:', error);
      setFormState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'An error occurred while opening the business form.',
      }));
    }
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

  const setBusinessSuccessMessage = (message: string | null) => {
    setFormState(prev => ({
      ...prev,
      businessSuccessMessage: message,
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
      phone: formState.phone || formState.locationPhone,
      mobilePhone: formState.mobilePhone,
    };
  };

  return {
    formState,
    updateField,
    setUserType: (userType: UserType) => updateField('userType', userType),
    setError,
    setFieldErrors,
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
    setBusinessSuccessMessage,
    getPersonalData,
  };
}

