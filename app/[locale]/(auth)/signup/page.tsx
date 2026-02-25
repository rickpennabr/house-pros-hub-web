'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AuthPageLayout } from '@/components/auth/AuthPageLayout';
import { USER_TYPES } from '@/lib/constants/auth';
import { useSignupForm } from './hooks/useSignupForm';
import { SignupHeader } from './components/SignupHeader';
import { SignupStepsIndicator } from './components/SignupStepsIndicator';
import { SignupNavigation } from './components/SignupNavigation';
import { AddBusinessModal } from './components/AddBusinessModal';
import { AddBusinessForm } from './components/AddBusinessForm';
import { SignupSuccessMessage } from './components/SignupSuccessMessage';
import { BusinessSuccessMessage } from './components/BusinessSuccessMessage';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { RoleSelectionScreen } from './components/RoleSelectionScreen';
import { CustomerStep1 } from './components/steps/CustomerStep1';
import { CustomerStep2 } from './components/steps/CustomerStep2';
import { CustomerStep3 } from './components/steps/CustomerStep3';
import { useAuth } from '@/contexts/AuthContext';
import { businessStorage } from '@/lib/storage/businessStorage';
import { useBeforeUnloadWarning } from './hooks/useBeforeUnloadWarning';
import { LeavePageWarningModal } from './components/LeavePageWarningModal';
import { FormProvider } from 'react-hook-form';
import type { BusinessFormValues } from '@/lib/schemas/business';

type SignupStep = 'role-selection' | 'form' | 'success' | 'business-form';

function SignUpForm() {
  const searchParams = useSearchParams();
  const t = useTranslations('auth.signup');
  const { user, checkAuth } = useAuth();
  
  // Get role from URL if coming from Free Estimate button
  const urlRole = searchParams.get('role') as 'customer' | 'contractor' | null;
  const skipRoleSelection = searchParams.get('skipRoleSelection') === 'true';
  
  // If skipRoleSelection is true, go directly to form step (skip role selection)
  // Otherwise, show role selection unless role is in URL
  const [currentStep, setCurrentStep] = useState<SignupStep>(
    skipRoleSelection || urlRole ? 'form' : 'role-selection'
  );
  const [selectedRole, setSelectedRole] = useState<'customer' | 'contractor' | null>(
    skipRoleSelection ? 'customer' : urlRole
  );
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  const {
    formState,
    methods,
    setUserType,
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
  } = useSignupForm({ selectedRole });

  // Set user type when role is selected (for form display)
  if (selectedRole && formState.userType !== selectedRole) {
    setUserType(selectedRole === 'customer' ? USER_TYPES.CUSTOMER : USER_TYPES.CONTRACTOR);
  }

  // Show warning when user tries to leave on steps 2, 3, or 4
  // Disable warning when success message or business success message is shown
  const { showModal, handleConfirmLeave, handleCancelLeave, allowNavigation } = useBeforeUnloadWarning(
    formState.currentStep,
    currentStep === 'form' && !formState.showAddBusinessForm && !formState.successMessage && !formState.businessSuccessMessage
  );

  const handleStepNext = async () => {
    await handleNext();
  };

  const handleRoleSelect = (role: 'customer' | 'contractor') => {
    setSelectedRole(role);
    setCurrentStep('form');
    setIsAuthLoading(false);
  };

  const handleBusinessSubmit = async (businessFormData: BusinessFormValues) => {
    // Use user from AuthContext (Supabase session) or signed up user from form state
    // This handles the case where signup succeeded but auth session isn't ready yet
    let currentUser = user;
    
    if (!currentUser || !currentUser.id) {
      // Try to use signedUpUser from form state (stored after successful signup)
      if (formState.signedUpUser && formState.signedUpUser.id) {
        currentUser = formState.signedUpUser;
      } else {
        // Last resort: try to check auth with timeout protection
        try {
          const checkAuthPromise = checkAuth();
          const timeoutPromise = new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('Auth check timeout')), 5000)
          );
          await Promise.race([checkAuthPromise, timeoutPromise]);
          currentUser = user;
        } catch (authError) {
          console.warn('Auth check failed or timed out:', authError);
          // Continue anyway if we have signedUpUser
          if (formState.signedUpUser && formState.signedUpUser.id) {
            currentUser = formState.signedUpUser;
          }
        }
      }
    }

    if (!currentUser || !currentUser.id) {
      throw new Error('You must be logged in to create a business. Please refresh the page and sign in again.');
    }

    // Get CSRF token for authenticated request
    let csrfToken: string;
    try {
      const csrfResponse = await fetch('/api/csrf-token', {
        method: 'GET',
        credentials: 'include',
      });
      if (!csrfResponse.ok) {
        throw new Error('Failed to get CSRF token');
      }
      const csrfData = await csrfResponse.json();
      csrfToken = csrfData.csrfToken;
    } catch (csrfError) {
      console.error('Error getting CSRF token:', csrfError);
      throw new Error('Failed to get security token. Please refresh the page and try again.');
    }

    const response = await fetch('/api/business/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      body: JSON.stringify({
        ...businessFormData,
        userId: currentUser.id,
        csrfToken,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create business');
    }

    const result = await response.json();
    const business = result.business;

    businessStorage.addBusiness(business);
    handleBusinessFormClose();
    setBusinessSuccessMessage('Business created successfully!');
    // Store the business ID so we can pass it to the success message
    if (business?.id) {
      // Store in a way that can be accessed by BusinessSuccessMessage
      // We'll use sessionStorage as a bridge
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('newlyCreatedBusinessId', business.id);
      }
    }
  };

  const renderStep = () => {
    // Both customers and contractors now use the same steps
    switch (formState.currentStep) {
      case 1:
        return <CustomerStep1 />;
      case 2:
        return (
          <CustomerStep2
            onAddressSelect={handleAddressSelect}
            onAddressChange={handleAddressChange}
          />
        );
      case 3:
        return <CustomerStep3 />;
      default:
        return null;
    }
  };

  return (
    <AuthPageLayout>
      <div className="w-full max-w-md mx-auto flex flex-col text-black pt-3 md:pt-0">
        {/* Leave Page Warning Modal */}
        <LeavePageWarningModal
          isOpen={showModal}
          onConfirm={handleConfirmLeave}
          onCancel={handleCancelLeave}
        />

        {/* Add Business Modal */}
        {formState.showAddBusinessModal && (
          <AddBusinessModal
            isOpen={formState.showAddBusinessModal}
            onClose={handleModalClose}
          />
        )}

        {/* Step 1: Role Selection */}
        {currentStep === 'role-selection' && (
          <RoleSelectionScreen
            onRoleSelect={handleRoleSelect}
            isLoading={isAuthLoading}
          />
        )}

        {/* Step 2: Form Steps */}
        {currentStep === 'form' && (
          <>
            {/* Add Business Form - takes priority */}
            {formState.showAddBusinessForm ? (
              <AddBusinessForm
                personalData={getPersonalData()}
                onSubmit={handleBusinessSubmit}
              />
            ) : formState.businessSuccessMessage ? (
              <>
                <SignupHeader isLoading={false} />
                <BusinessSuccessMessage onAllowNavigation={allowNavigation} />
              </>
            ) : formState.successMessage ? (
              <>
                <SignupHeader isLoading={false} />
                <SignupSuccessMessage
                  userType={formState.userType}
                  onAddBusiness={handleAddBusiness}
                  returnUrl={searchParams.get('returnUrl')}
                />
              </>
            ) : (
              <FormProvider {...methods}>
                {/* Header Section */}
                <SignupHeader
                  isLoading={formState.isLoading}
                />

                {/* Progress Bar Section */}
                <div>
                  <SignupStepsIndicator
                    currentStep={formState.currentStep}
                    totalSteps={getTotalSteps()}
                    stepLabel={getStepLabel()}
                  />
                </div>

                {/* Form Section */}
                <form onSubmit={handleSignUp} className="flex-1 flex flex-col min-h-[400px]">
                  <ErrorMessage message={formState.error || ''} />
                  {renderStep()}

                  <SignupNavigation
                    currentStep={formState.currentStep}
                    totalSteps={getTotalSteps()}
                    isLoading={formState.isLoading}
                    agreeToTerms={formState.agreeToTerms}
                    userType={formState.userType}
                    onPrevious={handlePrevious}
                    onNext={handleStepNext}
                    onAddBusiness={handleAddBusiness}
                  />
                </form>
              </FormProvider>
            )}
          </>
        )}
      </div>
    </AuthPageLayout>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={
      <AuthPageLayout>
        <div className="w-full max-w-md mx-auto flex flex-col items-center justify-center min-h-[400px]">
          <p className="text-gray-600">Loading...</p>
        </div>
      </AuthPageLayout>
    }>
      <SignUpForm />
    </Suspense>
  );
}
