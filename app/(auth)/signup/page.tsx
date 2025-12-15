'use client';

import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { AuthPageLayout } from '@/components/auth/AuthPageLayout';
import { USER_TYPES } from '@/lib/constants/auth';
import { useSignupForm } from './hooks/useSignupForm';
import { validateCurrentStep } from './utils/signupValidation';
import { SignupHeader } from './components/SignupHeader';
import { SignupStepsIndicator } from './components/SignupStepsIndicator';
import { SignupNavigation } from './components/SignupNavigation';
import { SignupSuccessMessage } from './components/SignupSuccessMessage';
import { AddBusinessModal } from './components/AddBusinessModal';
import { AddBusinessForm } from './components/AddBusinessForm';
import { CustomerStep1 } from './components/steps/CustomerStep1';
import { CustomerStep2 } from './components/steps/CustomerStep2';
import { CustomerStep3 } from './components/steps/CustomerStep3';
import { ContractorStep1 } from './components/steps/ContractorStep1';
import { ContractorStep2 } from './components/steps/ContractorStep2';
import { ContractorStep3 } from './components/steps/ContractorStep3';
import { ContractorStep4 } from './components/steps/ContractorStep4';
import { validateBusinessForm } from './utils/businessValidation';

export default function SignUpPage() {
  const {
    formState,
    updateField,
    setUserType,
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
  } = useSignupForm();

  const handleStepNext = () => {
    const validation = validateCurrentStep(formState);
    if (validation.isValid) {
      handleNext();
    } else {
      setError(validation.error);
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

    // Call API to create business
    const response = await fetch('/api/business/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(businessFormData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create business');
    }

    // Close form and redirect or show success
    handleBusinessFormClose();
    // Optionally redirect to account management or show success message
    // window.location.href = '/account-management';
  };

  const renderStep = () => {
    if (formState.userType === USER_TYPES.CUSTOMER) {
      switch (formState.currentStep) {
        case 1:
          return <CustomerStep1 formState={formState} updateField={updateField} />;
        case 2:
          return (
            <CustomerStep2
              formState={formState}
              updateField={updateField}
              onAddressSelect={handleAddressSelect}
              onAddressChange={handleAddressChange}
            />
          );
        case 3:
          return <CustomerStep3 formState={formState} updateField={updateField} />;
        default:
          return null;
      }
    } else {
      switch (formState.currentStep) {
        case 1:
          return <ContractorStep1 formState={formState} updateField={updateField} />;
        case 2:
          return <ContractorStep2 formState={formState} updateField={updateField} />;
        case 3:
          return <ContractorStep3 formState={formState} updateField={updateField} />;
        case 4:
          return <ContractorStep4 formState={formState} updateField={updateField} />;
        default:
          return null;
      }
    }
  };

  return (
    <AuthPageLayout>
      <div className="w-full max-w-md mx-auto flex flex-col">
        {/* Add Business Modal */}
        {formState.showAddBusinessModal && (
          <AddBusinessModal
            isOpen={formState.showAddBusinessModal}
            onClose={handleModalClose}
          />
        )}

        {/* Add Business Form */}
        {formState.showAddBusinessForm ? (
          <AddBusinessForm
            personalData={getPersonalData()}
            onSubmit={handleBusinessSubmit}
          />
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

            <ErrorMessage message={formState.error || ''} />

            {formState.signupSuccess ? (
              <SignupSuccessMessage onAddBusiness={handleAddBusiness} />
            ) : (
              <form onSubmit={handleFormSubmit} className="space-y-6 flex-1 flex flex-col min-h-[400px]">
                {renderStep()}

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
            )}
          </>
        )}
      </div>
    </AuthPageLayout>
  );
}
