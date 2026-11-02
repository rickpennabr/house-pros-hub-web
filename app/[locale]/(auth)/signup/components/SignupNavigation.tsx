'use client';

import { Button } from '@/components/ui/Button';
import { useTranslations } from 'next-intl';
import { USER_TYPES, type UserType } from '@/lib/constants/auth';

interface SignupNavigationProps {
  currentStep: number;
  totalSteps: number;
  isLoading: boolean;
  agreeToTerms: boolean;
  userType?: UserType;
  showGoogleSignUp?: boolean;
  showBackOnFirstStep?: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onGoogleSignUp?: () => void;
  onAddBusiness?: () => void | Promise<void>;
}

export function SignupNavigation({
  currentStep,
  totalSteps,
  isLoading,
  agreeToTerms,
  userType,
  showGoogleSignUp = false,
  showBackOnFirstStep = false,
  onPrevious,
  onNext,
  onGoogleSignUp,
  onAddBusiness,
}: SignupNavigationProps) {
  const t = useTranslations('auth.signup.navigation');
  const isProSignup = userType === USER_TYPES.CONTRACTOR || userType === USER_TYPES.REALTOR;
  const showGoogle = showGoogleSignUp && currentStep < totalSteps;

  return (
    <div className="flex flex-col gap-3 pt-4 mt-auto">
    <div className="flex gap-4">
      {(currentStep > 1 || showBackOnFirstStep) && (
        <Button
          type="button"
          variant="secondary"
          onClick={onPrevious}
          disabled={isLoading}
          className="flex-1 whitespace-nowrap px-2 md:px-4 py-2 md:py-3"
        >
          {t('previous')}
        </Button>
      )}
      {currentStep < totalSteps ? (
        <Button
          type="button"
          variant="primary"
          onClick={onNext}
          disabled={isLoading}
          className="flex-1 whitespace-nowrap px-2 md:px-4 py-2 md:py-3"
        >
          {t('next')}
        </Button>
      ) : (
        <>
          {isProSignup ? (
            // For contractors/realtors, show "Add a Business" button
            // But first submit the form to sign up, then business form will show automatically
            <Button
              type="submit"
              variant="primary"
              disabled={isLoading || !agreeToTerms}
              className={`flex-1 whitespace-nowrap px-2 md:px-4 py-2 md:py-3 ${
                agreeToTerms && !isLoading ? 'bg-black text-white' : ''
              }`}
            >
              {isLoading ? t('submitting') : t('addBusiness')}
            </Button>
          ) : (
            // For customers, show regular "Sign Up" button
            <Button
              type="submit"
              variant="primary"
              disabled={isLoading || !agreeToTerms}
              className={`flex-1 whitespace-nowrap px-2 md:px-4 py-2 md:py-3 ${
                agreeToTerms && !isLoading ? 'bg-black text-white' : ''
              }`}
            >
              {isLoading ? t('submitting') : t('submit')}
            </Button>
          )}
        </>
      )}
    </div>
    {showGoogle && (
      <Button
        type="button"
        variant="secondary"
        onClick={onGoogleSignUp}
        disabled={isLoading}
        className="flex w-full items-center justify-center whitespace-nowrap px-2 py-2 leading-none md:px-4 md:py-3"
      >
        <span className="inline-flex items-center justify-center gap-2">
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          {t('signUpWithGoogle')}
        </span>
      </Button>
    )}
    </div>
  );
}

