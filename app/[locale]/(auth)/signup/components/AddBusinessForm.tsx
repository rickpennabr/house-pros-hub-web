'use client';

import { useTranslations } from 'next-intl';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { SignupHeader } from './SignupHeader';
import { SignupStepsIndicator } from './SignupStepsIndicator';
import { BusinessFormNavigation } from './BusinessFormNavigation';
import { BusinessStep1 } from './steps/BusinessStep1';
import { BusinessStepLicenses } from './steps/BusinessStepLicenses';
import { BusinessStepServices } from './steps/BusinessStepServices';
import { BusinessStepImages } from './steps/BusinessStepImages';
import { BusinessStep2 } from './steps/BusinessStep2';
import { BusinessStep3 } from './steps/BusinessStep3';
import { BusinessStep4 } from './steps/BusinessStep4';
import { useAddBusinessForm } from '../hooks/useAddBusinessForm';
import { type PersonalData } from '@/lib/utils/personalData';
import { useBeforeUnloadWarning } from '../hooks/useBeforeUnloadWarning';
import { LeavePageWarningModal } from './LeavePageWarningModal';
import { FormProvider, type FieldErrors } from 'react-hook-form';
import type { BusinessFormValues } from '@/lib/schemas/business';

interface AddBusinessFormProps {
  personalData?: PersonalData;
  onSubmit: (formData: BusinessFormValues) => Promise<void>;
}

export function AddBusinessForm({
  personalData,
  onSubmit,
}: AddBusinessFormProps) {
  const t = useTranslations('businessForm');
  const tSignup = useTranslations('auth.signup.navigation');
  const {
    formState,
    methods,
    applyPersonalAddress,
    applyPersonalEmail,
    applyPersonalPhone,
    applyPersonalMobilePhone,
    handleAddressSelect,
    handleAddressChange,
    updateLink,
    reorderLinks,
    reorderLicenses,
    reorderServices,
    setError,
    setLoading,
    getTotalSteps,
    getStepLabel,
    handleNext,
    handlePrevious,
    handleSubmit,
  } = useAddBusinessForm(personalData);

  // Show warning when user tries to leave on steps 2, 3, or 4
  const { showModal, handleConfirmLeave, handleCancelLeave } = useBeforeUnloadWarning(formState.currentStep);

  const handleFormSubmit = handleSubmit(
    async (data: BusinessFormValues) => {
      setError(null);
      setLoading(true);
      try {
        await onSubmit(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create business');
      } finally {
        setLoading(false);
      }
    },
    (errors: FieldErrors<BusinessFormValues>) => {
      console.error('Validation errors:', errors);
      const errorCount = Object.keys(errors).length;
      const firstError = Object.values(errors)[0];
      const message =
        typeof firstError === 'object' &&
        firstError !== null &&
        'message' in firstError &&
        typeof (firstError as { message?: unknown }).message === 'string'
          ? (firstError as { message: string }).message
          : 'Please fix the errors in the form before submitting.';
      setError(`Please fix ${errorCount} error(s) in the form: ${message}`);
    }
  );

  const renderStep = () => {
    switch (formState.currentStep) {
      case 1:
        return <BusinessStep1 />;
      case 2:
        return <BusinessStepLicenses reorderLicenses={reorderLicenses} />;
      case 3:
        return <BusinessStepServices reorderServices={reorderServices} />;
      case 4:
        return <BusinessStepImages />;
      case 5:
        return (
          <BusinessStep2
            handleAddressSelect={handleAddressSelect}
            handleAddressChange={handleAddressChange}
            applyPersonalAddress={applyPersonalAddress}
            personalData={personalData}
          />
        );
      case 6:
        return (
          <BusinessStep3
            applyPersonalEmail={applyPersonalEmail}
            applyPersonalPhone={applyPersonalPhone}
            applyPersonalMobilePhone={applyPersonalMobilePhone}
            personalData={personalData}
          />
        );
      case 7:
        return (
          <BusinessStep4
            updateLink={updateLink}
            reorderLinks={reorderLinks}
            personalData={personalData}
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
      <div className="w-full max-w-md mx-auto flex flex-col text-black">
        <FormProvider {...methods}>
          <div className="md:sticky md:top-0 md:z-30 -mx-3 md:-mx-12 px-3 md:px-12 pt-0 bg-white md:pb-1">
            <SignupHeader isLoading={formState.isLoading} />
            {/* While creating business: show bot typing (same idea as customer signup); otherwise show progress + form */}
            {!formState.isLoading && (
              <SignupStepsIndicator
                currentStep={formState.currentStep}
                totalSteps={getTotalSteps()}
                stepLabel={t(getStepLabel())}
              />
            )}
          </div>

          <ErrorMessage message={formState.error || ''} />

          <form onSubmit={handleFormSubmit} className="space-y-6 flex-1 flex flex-col min-h-[400px]">
            {formState.isLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center min-h-[320px] py-6 gap-6">
                <div className="flex flex-col items-center gap-2 text-center">
                  <p className="text-lg font-semibold text-black">
                    {tSignup('holdOn')}
                  </p>
                  <p className="text-base text-gray-700">
                    {tSignup('almostDone')}
                  </p>
                </div>
                <img
                  src="/pro-bot-typing-creating-account.gif"
                  alt={t('navigation.finishing')}
                  className="w-full max-w-[200px] h-auto object-contain"
                  width={200}
                  height={168}
                />
              </div>
            ) : (
              renderStep()
            )}

            <BusinessFormNavigation
              currentStep={formState.currentStep}
              totalSteps={getTotalSteps()}
              isLoading={formState.isLoading}
              onPrevious={handlePrevious}
              onNext={handleNext}
              onSubmit={handleFormSubmit}
            />
          </form>
        </FormProvider>
      </div>
    </>
  );
}
