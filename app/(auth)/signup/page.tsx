'use client';

import { AuthPageLayout } from '@/components/auth/AuthPageLayout';
import { USER_TYPES } from '@/lib/constants/auth';
import { useSignupForm } from './hooks/useSignupForm';
import { validateCurrentStep } from './utils/signupValidation';
import { SignupHeader } from './components/SignupHeader';
import { SignupStepsIndicator } from './components/SignupStepsIndicator';
import { SignupNavigation } from './components/SignupNavigation';
import { AddBusinessModal } from './components/AddBusinessModal';
import { AddBusinessForm } from './components/AddBusinessForm';
import { SignupSuccessMessage } from './components/SignupSuccessMessage';
import { BusinessSuccessMessage } from './components/BusinessSuccessMessage';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { CustomerStep1 } from './components/steps/CustomerStep1';
import { CustomerStep2 } from './components/steps/CustomerStep2';
import { CustomerStep3 } from './components/steps/CustomerStep3';
import { ContractorStep1 } from './components/steps/ContractorStep1';
import { ContractorStep2 } from './components/steps/ContractorStep2';
import { ContractorStep3 } from './components/steps/ContractorStep3';
import { ContractorStep4 } from './components/steps/ContractorStep4';
import { validateBusinessForm } from './utils/businessValidation';
import { useAuth } from '@/contexts/AuthContext';
import { businessStorage } from '@/lib/storage/businessStorage';
import { authStorage } from '@/lib/storage/authStorage';
import { Suspense } from 'react';
import { useBeforeUnloadWarning } from './hooks/useBeforeUnloadWarning';
import { LeavePageWarningModal } from './components/LeavePageWarningModal';

function SignUpForm() {
  const { user, checkAuth } = useAuth();
  const {
    formState,
    updateField,
    setUserType,
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
  } = useSignupForm();

  // Show warning when user tries to leave on steps 2, 3, or 4
  // Only enable when showing the signup form (not the business form or success message)
  const { showModal, handleConfirmLeave, handleCancelLeave } = useBeforeUnloadWarning(
    formState.currentStep,
    !formState.showAddBusinessForm && !formState.successMessage
  );

  const handleStepNext = () => {
    const validation = validateCurrentStep(formState);
    if (validation.isValid) {
      handleNext();
    } else {
      setFieldErrors(validation.fieldErrors);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleSignUp();
  };

  const handleBusinessSubmit = async (businessFormData: any) => {
    // Validate the business form
    const validation = validateBusinessForm(businessFormData);
    if (!validation.isValid) {
      throw new Error(validation.error || 'Validation failed');
    }

    // Always sync auth state first to ensure context is updated
    await checkAuth();

    // Use localStorage as source of truth (synchronous, always available)
    // This is more reliable than React context which updates asynchronously
    const storedUser = authStorage.getUser();
    const storedToken = authStorage.getToken();

    // Verify we have both user and token
    let currentUser: typeof storedUser;
    
    if (storedUser && storedToken && storedUser.id) {
      // localStorage has valid user - use it as source of truth
      currentUser = storedUser;
    } else {
      // Last resort: check context (might be stale but could work)
      const contextUser = user;
      if (contextUser && contextUser.id) {
        currentUser = contextUser;
      } else {
        // No user found anywhere - authentication failed
        throw new Error('You must be logged in to create a business. Please sign up first.');
      }
    }

    if (!currentUser || !currentUser.id) {
      throw new Error('You must be logged in to create a business. Please sign up first.');
    }

    // Call API to create business
    const response = await fetch('/api/business/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...businessFormData,
        userId: currentUser.id,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create business');
    }

    const result = await response.json();
    const business = result.business;

    // Store business in localStorage for local testing
    businessStorage.addBusiness(business);

    // Close the business form and show business success message
    handleBusinessFormClose();
    setBusinessSuccessMessage('Business created successfully!');
  };

  const renderStep = (fieldErrors: { [key: string]: string | undefined }) => {
    if (formState.userType === USER_TYPES.CUSTOMER) {
      switch (formState.currentStep) {
        case 1:
          return <CustomerStep1 formState={formState} updateField={updateField} fieldErrors={fieldErrors} />;
        case 2:
          return (
            <CustomerStep2
              formState={formState}
              updateField={updateField}
              onAddressSelect={handleAddressSelect}
              onAddressChange={handleAddressChange}
              fieldErrors={fieldErrors}
            />
          );
        case 3:
          return <CustomerStep3 formState={formState} updateField={updateField} fieldErrors={fieldErrors} />;
        default:
          return null;
      }
    } else {
      switch (formState.currentStep) {
        case 1:
          return <ContractorStep1 formState={formState} updateField={updateField} fieldErrors={fieldErrors} />;
        case 2:
          return <ContractorStep2 formState={formState} updateField={updateField} fieldErrors={fieldErrors} />;
        case 3:
          return <ContractorStep3 formState={formState} updateField={updateField} fieldErrors={fieldErrors} />;
        case 4:
          return <ContractorStep4 formState={formState} updateField={updateField} fieldErrors={fieldErrors} />;
        default:
          return null;
      }
    }
  };

  return (
    <AuthPageLayout>
      <div className="w-full max-w-md mx-auto flex flex-col">
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

        {/* Add Business Form - takes priority */}
        {formState.showAddBusinessForm ? (
          <AddBusinessForm
            personalData={getPersonalData()}
            onSubmit={handleBusinessSubmit}
          />
        ) : formState.businessSuccessMessage ? (
          <>
            <SignupHeader isLoading={false} />
            <BusinessSuccessMessage />
          </>
        ) : formState.successMessage ? (
          <>
            <SignupHeader isLoading={false} />
            <SignupSuccessMessage userType={formState.userType} onAddBusiness={handleAddBusiness} />
          </>
        ) : (
          <>
            <div className="md:sticky md:top-0 md:z-20 md:bg-white">
              <SignupHeader
                isLoading={formState.isLoading}
              />

              <SignupStepsIndicator
                currentStep={formState.currentStep}
                totalSteps={getTotalSteps()}
                stepLabel={getStepLabel()}
              />
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-6 flex-1 flex flex-col min-h-[400px]">
              <ErrorMessage message={formState.error || ''} />
              {renderStep(formState.fieldErrors)}

              <SignupNavigation
                currentStep={formState.currentStep}
                totalSteps={getTotalSteps()}
                isLoading={formState.isLoading}
                agreeToTerms={formState.agreeToTerms}
                onPrevious={handlePrevious}
                onNext={handleStepNext}
                onAddBusiness={handleAddBusiness}
              />
            </form>
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
