'use client';

import { useState, Suspense, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { AuthPageLayout } from '@/components/auth/AuthPageLayout';
import { GoogleHandoffOverlay } from '@/components/auth/GoogleHandoffOverlay';
import { isProSignup, signupUserType } from '@/lib/constants/auth';
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
import { CustomerSignupChoiceScreen } from './components/CustomerSignupChoiceScreen';
import { InstallerProfileForm } from './components/InstallerProfileForm';
import { InvitationCodeScreen } from './components/InvitationCodeScreen';
import { CustomerStep1 } from './components/steps/CustomerStep1';
import { CustomerStep2 } from './components/steps/CustomerStep2';
import { CustomerStep3 } from './components/steps/CustomerStep3';
import { useAuth } from '@/contexts/AuthContext';
import { useAccountSwitch } from '@/contexts/AccountSwitchContext';
import { useBeforeUnloadWarning } from './hooks/useBeforeUnloadWarning';
import { LeavePageWarningModal } from './components/LeavePageWarningModal';
import { FormProvider } from 'react-hook-form';
import type { BusinessFormValues } from '@/lib/schemas/business';

type SignupStep = 'role-selection' | 'customer-signup-choice' | 'invitation-code' | 'form' | 'success' | 'business-form';

function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const t = useTranslations('auth.signup');
  const tHandoff = useTranslations('auth.googleHandoff');
  const { user, checkAuth } = useAuth();
  const { refreshBusinesses } = useAccountSwitch();
  
  // Get role from URL if coming from Free Estimate button
  const urlRole = searchParams.get('role') as 'customer' | 'contractor' | 'realtor' | 'installer' | null;
  const skipRoleSelection = searchParams.get('skipRoleSelection') === 'true';
  
  // Customers pick form or Google before the form. Pros with a role in the URL enter an invitation code first.
  const [currentStep, setCurrentStep] = useState<SignupStep>(() => {
    if (skipRoleSelection || urlRole === 'customer') return 'customer-signup-choice';
    if (urlRole === 'contractor' || urlRole === 'realtor' || urlRole === 'installer') return 'invitation-code';
    return 'role-selection';
  });
  const [selectedRole, setSelectedRole] = useState<'customer' | 'contractor' | 'realtor' | 'installer' | null>(
    skipRoleSelection ? 'customer' : urlRole
  );
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [customerChoseForm, setCustomerChoseForm] = useState(false);

  const {
    formState,
    methods,
    setUserType,
    updateField,
    getTotalSteps,
    getStepLabel,
    handleNext,
    handlePrevious,
    setError,
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
  const roleUserType = signupUserType(selectedRole);
  if (selectedRole && formState.userType !== roleUserType) {
    setUserType(roleUserType);
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

  const returnUrl = searchParams.get('returnUrl');
  const continueToEstimate = Boolean(returnUrl?.includes('/estimate'));

  // The header Free Estimate button is the only signup that should skip the thanks
  // screen. Profile sign-up has no estimate return path, so it keeps that screen.
  useEffect(() => {
    if (!formState.successMessage || !continueToEstimate || !returnUrl) return;
    sessionStorage.setItem('estimate_post_signup', '1');
    router.replace(returnUrl);
  }, [formState.successMessage, continueToEstimate, returnUrl, router]);

  const appliedOauthError = useRef(false);
  useEffect(() => {
    const oauthError = searchParams.get('error');
    if (!appliedOauthError.current && oauthError && selectedRole === 'customer') {
      appliedOauthError.current = true;
      setError(oauthError);
    }
  }, [searchParams, selectedRole, setError]);

  const handleGoogleSignUp = async () => {
    // A second OAuth start overwrites the PKCE verifier of the first one, so the
    // callback for the earlier code can no longer be exchanged.
    if (isGoogleLoading) return;
    setError(null);
    setIsGoogleLoading(true);
    const returnUrl = searchParams.get('returnUrl');
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `hph_oauth_flow=customer; Path=/; Max-Age=600; SameSite=Lax${secure}`;
    document.cookie = `hph_oauth_locale=${encodeURIComponent(locale)}; Path=/; Max-Age=600; SameSite=Lax${secure}`;
    if (returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//')) {
      document.cookie = `hph_oauth_next=${encodeURIComponent(returnUrl)}; Path=/; Max-Age=600; SameSite=Lax${secure}`;
    } else {
      document.cookie = 'hph_oauth_next=; Path=/; Max-Age=0; SameSite=Lax';
    }

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/api/auth/callback?locale=${encodeURIComponent(locale)}&flow=customer`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (error) {
      setError(t('errors.googleSignInFailed'));
      setIsGoogleLoading(false);
    }
  };

  const handleRoleSelect = (role: 'customer' | 'contractor' | 'realtor' | 'installer') => {
    setSelectedRole(role);
    setCustomerChoseForm(false);
    setCurrentStep(role === 'customer' ? 'customer-signup-choice' : 'invitation-code');
    setIsAuthLoading(false);
  };

  const handleCustomerFormChoice = () => {
    setError(null);
    setCustomerChoseForm(true);
    setCurrentStep('form');
  };

  const handleCustomerChoiceBack = () => {
    setError(null);
    setSelectedRole(null);
    setCustomerChoseForm(false);
    setCurrentStep('role-selection');
  };

  const handleInvitationCodeValid = (code: string) => {
    updateField('invitationCode', code);
    if (selectedRole) setUserType(signupUserType(selectedRole));
    setCurrentStep('form');
  };

  const handleInvitationCodeBack = () => {
    setSelectedRole(null);
    setCurrentStep('role-selection');
  };

  const handleStepPrevious = () => {
    if (formState.currentStep === 1 && selectedRole === 'customer' && customerChoseForm) {
      setCurrentStep('customer-signup-choice');
      return;
    }
    if (formState.currentStep === 1 && (selectedRole === 'contractor' || selectedRole === 'realtor' || selectedRole === 'installer')) {
      setCurrentStep('invitation-code');
      return;
    }
    handlePrevious();
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

    refreshBusinesses();
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
        return <CustomerStep1 proSignup={isProSignup(selectedRole)} />;
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
      <GoogleHandoffOverlay
        open={isGoogleLoading}
        title={tHandoff('title')}
        subtitle={tHandoff('subtitle')}
      />
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

        {currentStep === 'customer-signup-choice' && (
          <CustomerSignupChoiceScreen
            isLoading={isGoogleLoading}
            error={formState.error}
            onSignUpWithForm={handleCustomerFormChoice}
            onGoogleSignUp={handleGoogleSignUp}
            onBack={handleCustomerChoiceBack}
          />
        )}

        {/* Contractor or Realtor: Invitation code before personal info */}
        {currentStep === 'invitation-code' && (selectedRole === 'contractor' || selectedRole === 'realtor' || selectedRole === 'installer') && (
          <>
            <SignupHeader isLoading={false} />
            <InvitationCodeScreen
              role={selectedRole}
              onValidCode={handleInvitationCodeValid}
              onBack={handleInvitationCodeBack}
            />
          </>
        )}

        {/* Step 2: Form Steps */}
        {currentStep === 'form' && (
          <>
            {/* Add Business Form - takes priority */}
            {formState.showInstallerForm ? (
              <InstallerProfileForm />
            ) : formState.showAddBusinessForm ? (
              <AddBusinessForm
                personalData={getPersonalData()}
                onSubmit={handleBusinessSubmit}
              />
            ) : formState.businessSuccessMessage ? (
              <>
                <SignupHeader isLoading={false} />
                <BusinessSuccessMessage onAllowNavigation={allowNavigation} />
              </>
            ) : formState.successMessage && continueToEstimate ? (
              <div className="flex-1 flex flex-col items-center justify-center min-h-[320px] py-6 gap-6">
                <p className="text-lg font-semibold text-black">{t('navigation.estimatePreparingJustASecond')}</p>
                <p className="text-base text-gray-700">{t('navigation.estimatePreparingMessage')}</p>
              </div>
            ) : formState.successMessage ? (
              <>
                <SignupHeader isLoading={false} />
                <SignupSuccessMessage
                  userType={formState.userType}
                  onAddBusiness={handleAddBusiness}
                  returnUrl={returnUrl}
                />
              </>
            ) : (
              <FormProvider {...methods}>
                {/* Header: Logo + Sign In / Sign Up tabs */}
                <SignupHeader isLoading={formState.isLoading} />

                {/* While creating account: show bot typing GIF; otherwise show progress + form */}
                <form onSubmit={handleSignUp} className="flex-1 flex flex-col min-h-[400px]">
                  {formState.isLoading ? (
                    <div className="flex-1 flex flex-col items-center justify-center min-h-[320px] py-6 gap-6">
                      <div className="flex flex-col items-center gap-2 text-center">
                        <p className="text-lg font-semibold text-black">
                          {t('navigation.holdOn')}
                        </p>
                        <p className="text-base text-gray-700">
                          {t('navigation.almostDone')}
                        </p>
                      </div>
                      <img
                        src="/pro-bot-typing-creating-account.gif"
                        alt={t('navigation.submitting')}
                        className="w-full max-w-[200px] h-auto object-contain"
                        width={200}
                        height={168}
                      />
                    </div>
                  ) : (
                    <>
                      <div>
                        <SignupStepsIndicator
                          currentStep={formState.currentStep}
                          totalSteps={getTotalSteps()}
                          stepLabel={getStepLabel()}
                        />
                      </div>
                      <ErrorMessage message={formState.error || ''} />
                      {renderStep()}
                    </>
                  )}

                  <SignupNavigation
                    currentStep={formState.currentStep}
                    totalSteps={getTotalSteps()}
                    isLoading={formState.isLoading || isGoogleLoading}
                    agreeToTerms={formState.agreeToTerms}
                    userType={formState.userType}
                    showGoogleSignUp={selectedRole === 'customer' && !customerChoseForm}
                    showBackOnFirstStep={selectedRole === 'customer' && customerChoseForm}
                    onPrevious={handleStepPrevious}
                    onNext={handleStepNext}
                    onGoogleSignUp={handleGoogleSignUp}
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
