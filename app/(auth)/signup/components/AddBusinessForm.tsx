'use client';

import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { SignupHeader } from './SignupHeader';
import { SignupStepsIndicator } from './SignupStepsIndicator';
import { BusinessFormNavigation } from './BusinessFormNavigation';
import { BusinessStep1 } from './steps/BusinessStep1';
import { BusinessStep2 } from './steps/BusinessStep2';
import { BusinessStep3 } from './steps/BusinessStep3';
import { BusinessStep4 } from './steps/BusinessStep4';
import { useAddBusinessForm, PersonalData } from '../hooks/useAddBusinessForm';
import { validateBusinessStep } from '../utils/businessStepValidation';
import { validateBusinessForm } from '../utils/businessValidation';
import { useBeforeUnloadWarning } from '../hooks/useBeforeUnloadWarning';
import { LeavePageWarningModal } from './LeavePageWarningModal';

interface AddBusinessFormProps {
  personalData?: PersonalData;
  onSubmit: (formData: any) => Promise<void>;
}

export function AddBusinessForm({
  personalData,
  onSubmit,
}: AddBusinessFormProps) {
  const {
    formState,
    updateField,
    handleLicenseChange,
    addLicense,
    removeLicense,
    usePersonalAddress,
    usePersonalEmail,
    usePersonalPhone,
    usePersonalMobilePhone,
    handleAddressSelect,
    handleAddressChange,
    updateLink,
    reorderLinks,
    setError,
    setFieldErrors,
    setLoading,
    getTotalSteps,
    getStepLabel,
    handleNext,
    handlePrevious,
  } = useAddBusinessForm(personalData);

  // Show warning when user tries to leave on steps 2, 3, or 4
  const { showModal, handleConfirmLeave, handleCancelLeave } = useBeforeUnloadWarning(formState.currentStep);

  const handleStepNext = () => {
    const validation = validateBusinessStep(formState);
    if (validation.isValid) {
      handleNext();
    } else {
      setFieldErrors(validation.fieldErrors);
    }
  };

  const handleFormSubmit = async () => {
    setError(null);

    // Final validation
    const validation = validateBusinessForm(formState);
    if (!validation.isValid) {
      setError(validation.error);
      return;
    }

    setLoading(true);
    try {
      await onSubmit(formState);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create business');
    } finally {
      setLoading(false);
    }
  };

  const renderStep = (fieldErrors: { [key: string]: string | undefined } = {}) => {
    switch (formState.currentStep) {
      case 1:
        return (
          <BusinessStep1
            formState={formState}
            updateField={updateField}
            handleLicenseChange={handleLicenseChange}
            addLicense={addLicense}
            removeLicense={removeLicense}
            fieldErrors={fieldErrors}
          />
        );
      case 2:
        return (
          <BusinessStep2
            formState={formState}
            updateField={updateField}
            handleAddressSelect={handleAddressSelect}
            handleAddressChange={handleAddressChange}
            usePersonalAddress={usePersonalAddress}
            personalData={personalData}
            fieldErrors={fieldErrors}
          />
        );
      case 3:
        return (
          <BusinessStep3
            formState={formState}
            updateField={updateField}
            usePersonalEmail={usePersonalEmail}
            usePersonalPhone={usePersonalPhone}
            usePersonalMobilePhone={usePersonalMobilePhone}
            personalData={personalData}
            fieldErrors={fieldErrors}
          />
        );
      case 4:
        return (
          <BusinessStep4
            formState={formState}
            updateLink={updateLink}
            reorderLinks={reorderLinks}
            personalData={personalData}
            fieldErrors={fieldErrors}
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
      <LeavePageWarningModal
        isOpen={showModal}
        onConfirm={handleConfirmLeave}
        onCancel={handleCancelLeave}
      />
      <div className="w-full max-w-md mx-auto flex flex-col">
        <div className="md:sticky md:top-0 md:z-20 md:bg-white">
          <SignupHeader isLoading={formState.isLoading} />
          <SignupStepsIndicator
            currentStep={formState.currentStep}
            totalSteps={getTotalSteps()}
            stepLabel={getStepLabel()}
          />
        </div>

        <ErrorMessage message={formState.error || ''} />

        <div className="space-y-6 flex-1 flex flex-col min-h-[400px]">
          {renderStep(formState.fieldErrors)}

          <BusinessFormNavigation
            currentStep={formState.currentStep}
            totalSteps={getTotalSteps()}
            isLoading={formState.isLoading}
            onPrevious={handlePrevious}
            onNext={handleStepNext}
            onSubmit={handleFormSubmit}
          />
        </div>
      </div>
    </>
  );
}
