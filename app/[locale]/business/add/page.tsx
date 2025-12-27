'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { FormProvider } from 'react-hook-form';
import type { FieldErrors } from 'react-hook-form';

import { businessStorage } from '@/lib/storage/businessStorage';
import { useAuth } from '@/contexts/AuthContext';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { Settings, PlusCircle } from 'lucide-react';
import { createLocalePath, createSignInUrl } from '@/lib/redirect';
import { SignupStepsIndicator } from '@/app/[locale]/(auth)/signup/components/SignupStepsIndicator';
import { BusinessFormNavigation } from '@/app/[locale]/(auth)/signup/components/BusinessFormNavigation';
import { BusinessStep1 } from '@/app/[locale]/(auth)/signup/components/steps/BusinessStep1';
import { BusinessStepLicenses } from '@/app/[locale]/(auth)/signup/components/steps/BusinessStepLicenses';
import { BusinessStep2 } from '@/app/[locale]/(auth)/signup/components/steps/BusinessStep2';
import { BusinessStep3 } from '@/app/[locale]/(auth)/signup/components/steps/BusinessStep3';
import { BusinessStep4 } from '@/app/[locale]/(auth)/signup/components/steps/BusinessStep4';
import { useAddBusinessForm } from '@/app/[locale]/(auth)/signup/hooks/useAddBusinessForm';
import { useBeforeUnloadWarning } from '@/app/[locale]/(auth)/signup/hooks/useBeforeUnloadWarning';
import { LeavePageWarningModal } from '@/app/[locale]/(auth)/signup/components/LeavePageWarningModal';
import { BusinessSuccessModal } from '@/app/[locale]/(auth)/signup/components/BusinessSuccessModal';
import type { BusinessFormValues } from '@/lib/schemas/business';
import { extractPersonalData } from '@/lib/utils/personalData';
import type { Locale } from '@/i18n';
import { LinkItem } from '@/components/proscard/ProLinks';

export default function AddBusinessPage() {
  const router = useRouter();
  const locale = useLocale() as Locale;
  const t = useTranslations('accountManagement');
  const tBusinessForm = useTranslations('businessForm');
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

  // Extract personal data from user for "Same as Personal" functionality
  const personalData = extractPersonalData(user);

  const {
    formState,
    methods,
    handleAddressSelect,
    handleAddressChange,
    applyPersonalAddress,
    applyPersonalEmail,
    applyPersonalPhone,
    applyPersonalMobilePhone,
    updateLink,
    reorderLinks,
    setError,
    setLoading,
    getTotalSteps,
    getStepLabel,
    handleNext,
    handlePrevious,
    handleSubmit,
  } = useAddBusinessForm(personalData);

  // Check for pending contractor data from profile completion
  useEffect(() => {
    if (typeof window !== 'undefined' && methods) {
      const pendingDataStr = sessionStorage.getItem('pendingContractorData');
      if (pendingDataStr) {
        try {
          const pendingData = JSON.parse(pendingDataStr);
          
          // Pre-populate licenses if available
          if (pendingData.licenses && Array.isArray(pendingData.licenses) && pendingData.licenses.length > 0) {
            methods.setValue('licenses', pendingData.licenses);
          }

          // Pre-populate links if available
          if (pendingData.links && Array.isArray(pendingData.links) && pendingData.links.length > 0) {
            methods.setValue('links', pendingData.links);
            // Also add each link using updateLink to ensure proper formatting
            pendingData.links.forEach((link: LinkItem) => {
              if (link.type && (link.url || link.value)) {
                updateLink(link.type, link.url, link.value);
              }
            });
          }

          // Clear the stored data after pre-populating
          sessionStorage.removeItem('pendingContractorData');
        } catch (error) {
          console.error('Error parsing pending contractor data:', error);
          sessionStorage.removeItem('pendingContractorData');
        }
      }
    }
  }, [methods, updateLink]);

  // Show warning when user tries to leave on steps 2, 3, or 4
  // Disable warning when success modal is shown
  const { showModal, handleConfirmLeave, handleCancelLeave, allowNavigation } = useBeforeUnloadWarning(
    formState.currentStep,
    !isSuccessModalOpen
  );

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      router.push(createSignInUrl(locale, '/business/add'));
    }
  }, [isAuthenticated, isAuthLoading, router, locale]);

  const handleFormSubmit = handleSubmit(
    async (data: BusinessFormValues) => {
      setError(null);
      setLoading(true);
      try {
        if (!user) {
          throw new Error('You must be logged in to add a business');
        }

        // Get CSRF token for authenticated request
        let csrfToken: string;
        try {
          console.log('[CLIENT] Requesting CSRF token for userId:', user.id);
          
          const csrfResponse = await fetch('/api/csrf-token', {
            method: 'GET',
            credentials: 'include',
          });
          
          if (!csrfResponse.ok) {
            const errorText = await csrfResponse.text();
            console.error('[CLIENT] CSRF token request failed:', {
              status: csrfResponse.status,
              statusText: csrfResponse.statusText,
              error: errorText,
            });
            throw new Error('Failed to get CSRF token');
          }
          
          const csrfData = await csrfResponse.json();
          csrfToken = csrfData.csrfToken;
          
          console.log('[CLIENT] CSRF token received:', {
            tokenLength: csrfToken.length,
            tokenPrefix: csrfToken.substring(0, 10) + '...',
            userId: user.id,
          });
        } catch (csrfError) {
          console.error('[CLIENT] Error getting CSRF token:', csrfError);
          throw new Error('Failed to get security token. Please refresh the page and try again.');
        }

        // Call API to create business in Supabase
        console.log('[CLIENT] About to send POST request:', {
          url: '/api/business/create',
          hasToken: !!csrfToken,
          tokenInHeader: !!csrfToken,
          tokenInBody: true,
          userId: user.id,
          credentials: 'include',
        });

        const response = await fetch('/api/business/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken,
          },
          credentials: 'include',
          body: JSON.stringify({
            ...data,
            userId: user.id,
            csrfToken,
          }),
        });

        // Clear pending contractor data after business creation (success or failure)
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('pendingContractorData');
        }

        if (!response.ok) {
          const error = await response.json();
          console.error('[CLIENT] Business creation failed:', {
            status: response.status,
            statusText: response.statusText,
            error: error.error || 'Unknown error',
            diagnosticInfo: error,
          });
          
          // Show detailed error in development
          if (process.env.NODE_ENV === 'development' && error.userId) {
            console.error('[CLIENT] CSRF Diagnostic Info:', {
              userId: error.userId,
              tokenStoreSize: error.tokenStoreSize,
              tokenStoreUserIds: error.tokenStoreUserIds,
              hasTokenForUser: error.hasTokenForUser,
              tokenPrefix: error.tokenPrefix,
            });
          }
          
          throw new Error(error.error || 'Failed to create business');
        }

        const result = await response.json();
        const business = result.business;

        // Also save to localStorage for local access
        businessStorage.addBusiness(business);
        setIsSuccessModalOpen(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add business');
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
        return <BusinessStepLicenses />;
      case 3:
        return (
          <BusinessStep2
            handleAddressSelect={handleAddressSelect}
            handleAddressChange={handleAddressChange}
            applyPersonalAddress={applyPersonalAddress}
            personalData={personalData}
          />
        );
      case 4:
        return (
          <BusinessStep3
            applyPersonalEmail={applyPersonalEmail}
            applyPersonalPhone={applyPersonalPhone}
            applyPersonalMobilePhone={applyPersonalMobilePhone}
            personalData={personalData}
          />
        );
      case 5:
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

  if (isAuthLoading) {
    return <div className="flex justify-center p-8">Loading...</div>;
  }

  return (
    <>
      <BusinessSuccessModal
        isOpen={isSuccessModalOpen}
        onManageBusiness={() => router.push(createLocalePath(locale, '/account-management'))}
        onGoHome={() => router.push(createLocalePath(locale, '/'))}
        onAllowNavigation={allowNavigation}
      />
      <LeavePageWarningModal
        isOpen={showModal}
        onConfirm={handleConfirmLeave}
        onCancel={handleCancelLeave}
      />
      <div className="w-full max-w-2xl mx-auto p-2 md:p-6 py-2 md:py-4">
        {/* Breadcrumbs */}
        <Breadcrumb 
          items={[
            { label: t('title'), href: '/account-management', icon: Settings },
            { label: t('actions.business.addBusiness.title'), icon: PlusCircle }
          ]}
        />
        <FormProvider {...methods}>
          <div className="md:sticky md:top-0 md:z-20 md:bg-white mb-4">
            <SignupStepsIndicator
              currentStep={formState.currentStep}
              totalSteps={getTotalSteps()}
              stepLabel={tBusinessForm(getStepLabel())}
            />
          </div>

          <ErrorMessage message={formState.error || ''} />

          <form onSubmit={handleFormSubmit} className="space-y-6 flex-1 flex flex-col min-h-[400px]">
            {renderStep()}

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
