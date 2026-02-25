'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import type { FieldPath, FieldPathValue } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useAuth, type User } from '@/contexts/AuthContext';
import { USER_TYPES, type UserType } from '@/lib/constants/auth';
import { useAddressField } from '@/hooks/useAddressField';
import { type PersonalData } from '@/lib/utils/personalData';
import { signupSchema, type SignupSchema } from '@/lib/schemas/auth';

export interface SignupFormState {
  // UI state
  showPassword: boolean;
  showConfirmPassword: boolean;
  currentStep: number;
  error: string | null;
  successMessage: string | null;
  isLoading: boolean;
  showAddBusinessModal: boolean;
  showAddBusinessForm: boolean;
  businessSuccessMessage: string | null;
  
  // Authentication backup - store user after successful signup
  signedUpUser: User | null;
}

const initialUIState: SignupFormState = {
  showPassword: false,
  showConfirmPassword: false,
  currentStep: 1,
  error: null,
  successMessage: null,
  isLoading: false,
  showAddBusinessModal: false,
  showAddBusinessForm: false,
  businessSuccessMessage: null,
  signedUpUser: null,
};

interface UseSignupFormProps {
  selectedRole?: 'customer' | 'contractor' | 'both' | null;
}

export function useSignupForm({ selectedRole }: UseSignupFormProps = {}) {
  const { checkAuth, login, user } = useAuth();
  const tStep = useTranslations('auth.signup.stepLabels');
  const tChat = useTranslations('auth.signup.chat');
  
  const [uiState, setUiState] = useState<SignupFormState>(initialUIState);
  
  const methods = useForm<SignupSchema>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
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
      address: '',
      streetAddress: '',
      city: '',
      state: 'NV',
      zipCode: '',
      apartment: '',
      gateCode: '',
      addressNote: '',
      agreeToTerms: false,
      licenses: [], // Licenses will be added in business form
      userPicture: '',
      invitationCode: '',
    },
    mode: 'onChange',
  });

  const { 
    watch, 
    setValue, 
    trigger, 
    handleSubmit, 
    formState: { errors },
  } = methods;

  const userType = watch('userType');
  const referral = watch('referral');
  
  // Use ref as additional backup - persists across re-renders and doesn't get cleared
  const signedUpUserRef = useRef<User | null>(null);

  // Keep form userType in sync with selectedRole so step 3 shows invitation code when signing up as contractor
  useEffect(() => {
    if (selectedRole) {
      setValue('userType', selectedRole === 'customer' ? USER_TYPES.CUSTOMER : USER_TYPES.CONTRACTOR);
    }
  }, [selectedRole, setValue]);

  // Reset step when user type changes
  useEffect(() => {
    setUiState(prev => ({
      ...prev,
      currentStep: 1,
      error: null,
      signedUpUser: null,
    }));
    // We don't want to reset the whole form, just some fields if needed
    // But per current logic, it seems it clears a lot of things
    setValue('streetAddress', '');
    setValue('city', '');
    setValue('state', 'NV');
    setValue('zipCode', '');
    setValue('apartment', '');
    setValue('gateCode', '');
    setValue('addressNote', '');
    setValue('address', '');
  }, [userType, setValue]);

  const getTotalSteps = (): number => {
    // Both customers and contractors have 3 steps now
    return 3;
  };

  const getStepLabel = (): string => {
    // Use same labels for both customers and contractors
    switch (uiState.currentStep) {
      case 1: return tStep('customerPersonal');
      case 2: return tStep('customerAddress');
      case 3: return tStep('customerCredentials');
      default: return '';
    }
  };

  const handleNext = async () => {
    // Validate current step fields before moving next
    // Same validation for both customers and contractors
    let fieldsToValidate: FieldPath<SignupSchema>[] = [];
    
    if (uiState.currentStep === 1) {
      fieldsToValidate = ['firstName', 'lastName', 'referral'];
      if (referral === 'Other') fieldsToValidate.push('referralOther');
    } else if (uiState.currentStep === 2) {
      fieldsToValidate = ['streetAddress', 'city', 'state', 'zipCode'];
    }

    const isStepValid = await trigger(fieldsToValidate);
    
    if (isStepValid && uiState.currentStep < getTotalSteps()) {
      setUiState(prev => ({
        ...prev,
        currentStep: prev.currentStep + 1,
        error: null,
      }));
    }
  };

  const handlePrevious = () => {
    if (uiState.currentStep > 1) {
      setUiState(prev => ({
        ...prev,
        currentStep: prev.currentStep - 1,
        error: null,
      }));
    }
  };

  const { handleAddressSelect: baseHandleAddressSelect, handleAddressChange: baseHandleAddressChange } = useAddressField(setValue, trigger);

  const handleAddressSelect = baseHandleAddressSelect;
  const handleAddressChange = (value: string) => {
    // Pass true to include additional fields (gateCode, addressNote) for signup form
    baseHandleAddressChange(value, true);
  };

  const onSignUpSubmit = async (data: SignupSchema) => {
    setUiState(prev => ({ ...prev, error: null, isLoading: true }));

    try {
      // Check email uniqueness before calling signup API (same as bot flow)
      const email = data.email?.trim().toLowerCase();
      if (email) {
        const checkRes = await fetch('/api/auth/check-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const checkData = await checkRes.json().catch(() => ({}));
        if (checkData.available === false) {
          setUiState(prev => ({ ...prev, error: tChat('emailAlreadyExists'), isLoading: false }));
          return;
        }
      }

      // Determine role from selectedRole (from role selection screen) or userType (from form)
      let role: 'customer' | 'contractor' | 'both' | undefined;
      if (selectedRole) {
        role = selectedRole;
      } else if (userType === USER_TYPES.CUSTOMER) {
        role = 'customer';
      } else if (userType === USER_TYPES.CONTRACTOR) {
        role = 'contractor';
      }

      // Use API route to signup (bypasses RLS issues)
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          referral: data.referral,
          referralOther: data.referralOther,
          streetAddress: data.streetAddress,
          apartment: data.apartment,
          city: data.city,
          state: data.state,
          zipCode: data.zipCode,
          gateCode: data.gateCode,
          addressNote: data.addressNote,
          // Don't send companyName, companyRole, licenses here for contractors
          // They'll be added via business form
          userPicture: data.userPicture,
          userType: role,
          ...(role === 'contractor' && data.invitationCode ? { invitationCode: data.invitationCode.trim() } : {}),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create account');
      }

      const result = await response.json();
      const createdUser = result.user;

      // Explicitly sign in the user to ensure client-side session is set immediately
      // This is important even though email confirmation is disabled, as it ensures
      // the client-side Supabase client picks up the session right away
      // Add timeout protection to prevent hanging
      // Only attempt login if email and password are provided (not OAuth flow)
      let authSucceeded = false;
      if (data.email && data.password) {
        try {
          const loginPromise = login(data.email, data.password);
          const timeoutPromise = new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Login timeout')), 8000)
          );
          await Promise.race([loginPromise, timeoutPromise]);
          authSucceeded = true;
        } catch (loginError) {
          // If explicit login fails, checkAuth() should still work with cookies from API
          // This can happen if there's a timing issue, but the session should be available
          console.warn('Auto-login failed, checking auth via cookies:', loginError);
          try {
            const checkAuthPromise = checkAuth();
            const timeoutPromise = new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('Auth check timeout')), 5000)
            );
            await Promise.race([checkAuthPromise, timeoutPromise]);
            authSucceeded = true;
          } catch (checkAuthError) {
            // Even if checkAuth fails, we can still proceed - the user was created successfully
            // The session might be available via cookies, or user can sign in manually
            console.warn('Auth check failed, but signup was successful. User may need to sign in manually:', checkAuthError);
            // Don't throw - account was created successfully, auth can be retried later
          }
        }
      } else {
        // For OAuth flows or when email/password are not provided, just check auth
        try {
          const checkAuthPromise = checkAuth();
          const timeoutPromise = new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Auth check timeout')), 5000)
          );
          await Promise.race([checkAuthPromise, timeoutPromise]);
          authSucceeded = true;
        } catch (checkAuthError) {
          // Even if checkAuth fails, we can still proceed - the user was created successfully
          // The session might be available via cookies, or user can sign in manually
          console.warn('Auth check failed, but signup was successful. User may need to sign in manually:', checkAuthError);
          // Don't throw - account was created successfully, auth can be retried later
        }
      }

      // Update UI - proceed regardless of auth status since account was created
      // For contractors, show business form instead of success message
      if (role === 'contractor' || role === 'both') {
        setUiState(prev => ({
          ...prev,
          signedUpUser: createdUser as User,
          isLoading: false,
          showAddBusinessForm: true, // Show business form
          error: null, // Clear any previous errors
        }));
        signedUpUserRef.current = createdUser as User;
        // If auth failed, try one more time in background for business form
        if (!authSucceeded) {
          setTimeout(() => {
            checkAuth().catch(() => {
              // Silent fail - user can still proceed with business form
            });
          }, 1000);
        }
      } else {
        // For customers, show success message
        setUiState(prev => ({
          ...prev,
          successMessage: 'Thanks for signing up for House Pros Hub! Now you can contact your pro or request your free estimate.',
          signedUpUser: createdUser as User,
          error: null, // Clear any previous errors
          isLoading: false,
        }));
        signedUpUserRef.current = createdUser as User;
        // If auth failed, try one more time in background
        if (!authSucceeded) {
          setTimeout(() => {
            checkAuth().catch(() => {
              // Silent fail - user account was created successfully
            });
          }, 1000);
        }
      }
    } catch (err) {
      // If signup API call failed, show error
      const errorMessage = err instanceof Error ? err.message : 'Failed to create account. Please try again.';
      setUiState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false,
      }));
    } finally {
      // Always ensure isLoading is false, even if there was an unexpected error
      setUiState(prev => {
        if (prev.isLoading) {
          return { ...prev, isLoading: false };
        }
        return prev;
      });
    }
  };

  const onSignUpError = (errors: unknown) => {
    // Extract error messages from react-hook-form errors object
    const errorMessages: string[] = [];
    
    // Helper function to extract error message from nested error objects
    const extractErrorMessage = (error: unknown): string | null => {
      if (!error) return null;
      if (typeof error === 'string') return error;
      if (
        typeof error === 'object' &&
        error !== null &&
        'message' in error &&
        typeof (error as { message?: unknown }).message === 'string'
      ) {
        return (error as { message: string }).message;
      }
      if (
        typeof error === 'object' &&
        error !== null &&
        'type' in error &&
        (error as { type?: unknown }).type === 'required'
      ) {
        return 'This field is required';
      }
      return null;
    };

    // Collect all error messages
    Object.keys(errors as Record<string, unknown>).forEach((fieldName) => {
      const error = (errors as Record<string, unknown>)[fieldName];
      if (error) {
        // Handle nested errors (e.g., licenses array)
        if (Array.isArray(error)) {
          error.forEach((item, index) => {
            if (item && typeof item === 'object') {
              Object.keys(item as Record<string, unknown>).forEach((nestedField) => {
                const nestedError = extractErrorMessage((item as Record<string, unknown>)[nestedField]);
                if (nestedError) {
                  errorMessages.push(`${fieldName}[${index}].${nestedField}: ${nestedError}`);
                }
              });
            } else {
              const msg = extractErrorMessage(item);
              if (msg) errorMessages.push(`${fieldName}[${index}]: ${msg}`);
            }
          });
        } else {
          const msg = extractErrorMessage(error);
          if (msg) {
            // Create user-friendly field names
            const friendlyName = fieldName
              .replace(/([A-Z])/g, ' $1')
              .replace(/^./, (str) => str.toUpperCase())
              .trim();
            errorMessages.push(`${friendlyName}: ${msg}`);
          }
        }
      }
    });

    // Set error message in UI state
    const errorMessage = errorMessages.length > 0
      ? `Please fix the following errors:\n${errorMessages.slice(0, 3).join('\n')}${errorMessages.length > 3 ? `\n...and ${errorMessages.length - 3} more` : ''}`
      : 'Please check the form for errors and try again.';

    setUiState(prev => ({
      ...prev,
      error: errorMessage,
    }));

    // Scroll to first error field if possible
    const firstErrorField = Object.keys(errors as Record<string, unknown>)[0];
    if (firstErrorField) {
      // Try to find the input element by ID or name
      setTimeout(() => {
        const fieldId = firstErrorField === 'phone' ? 'phone' :
                       firstErrorField === 'email' ? 'signup-email' :
                       firstErrorField === 'password' ? 'signup-password' :
                       firstErrorField === 'confirmPassword' ? 'confirm-password' :
                       firstErrorField;
        const element = document.getElementById(fieldId) || 
                       document.querySelector(`[name="${firstErrorField}"]`) ||
                       document.querySelector(`input[name="${firstErrorField}"]`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          (element as HTMLElement).focus();
        }
      }, 100);
    }

  };

  const handleSignUp = handleSubmit(onSignUpSubmit, onSignUpError);

  const handleAddBusiness = async () => {
    // Use user from AuthContext (Supabase session) or signed up user
    let currentUser = signedUpUserRef.current || uiState.signedUpUser || user;

    if (!currentUser || !currentUser.id) {
      await checkAuth();
      currentUser = signedUpUserRef.current || uiState.signedUpUser || user;
    }

    if (!currentUser || !currentUser.id) {
      setUiState(prev => ({
        ...prev,
        error: 'Authentication data was lost. Please refresh the page and sign in again.',
      }));
      return;
    }

    setUiState(prev => ({ 
      ...prev, 
      showAddBusinessForm: true,
      businessSuccessMessage: null,
    }));
  };

  const getPersonalData = (): PersonalData => {
    const values = watch();
    return {
      address: values.address || '',
      streetAddress: values.streetAddress || '',
      city: values.city || '',
      state: values.state || '',
      zipCode: values.zipCode || '',
      apartment: values.apartment || '',
      email: values.email || '',
      phone: values.phone || '',
      mobilePhone: values.phone || '', // Using phone as fallback
    };
  };

  return {
    formState: {
      ...uiState,
      userType,
      referral,
      referralOther: watch('referralOther'),
      firstName: watch('firstName'),
      lastName: watch('lastName'),
      email: watch('email'),
      password: watch('password'),
      confirmPassword: watch('confirmPassword'),
      phone: watch('phone'),
      agreeToTerms: watch('agreeToTerms'),
      fieldErrors: Object.keys(errors).reduce((acc, key) => {
        const errorForKey = (errors as Record<string, unknown>)[key];
        acc[key] =
          typeof errorForKey === 'object' &&
          errorForKey !== null &&
          'message' in errorForKey &&
          typeof (errorForKey as { message?: unknown }).message === 'string'
            ? (errorForKey as { message: string }).message
            : undefined;
        return acc;
      }, {} as { [key: string]: string | undefined }),
    },
    methods, // Provide react-hook-form methods
    updateField: <TField extends FieldPath<SignupSchema>>(
      field: TField,
      value: FieldPathValue<SignupSchema, TField>
    ) => setValue(field, value),
    setUserType: (type: UserType) => setValue('userType', type),
    setError: (error: string | null) => setUiState(prev => ({ ...prev, error })),
    setFieldErrors: () => {}, // No-op now as it's handled by react-hook-form
    getTotalSteps,
    getStepLabel,
    handleNext,
    handlePrevious,
    handleAddressSelect,
    handleAddressChange,
    handleSignUp,
    handleAddBusiness,
    handleModalClose: () => setUiState(prev => ({ ...prev, showAddBusinessModal: false, showAddBusinessForm: true })),
    handleBusinessFormClose: () => setUiState(prev => ({ ...prev, showAddBusinessForm: false })),
    setBusinessSuccessMessage: (msg: string | null) => setUiState(prev => ({ ...prev, businessSuccessMessage: msg })),
    getPersonalData,
  };
}

