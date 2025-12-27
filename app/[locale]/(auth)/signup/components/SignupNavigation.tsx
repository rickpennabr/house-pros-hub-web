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
  onPrevious: () => void;
  onNext: () => void;
  onAddBusiness?: () => void | Promise<void>;
}

export function SignupNavigation({
  currentStep,
  totalSteps,
  isLoading,
  agreeToTerms,
  userType,
  onPrevious,
  onNext,
  onAddBusiness,
}: SignupNavigationProps) {
  const t = useTranslations('auth.signup.navigation');
  const isContractor = userType === USER_TYPES.CONTRACTOR;

  return (
    <div className="flex gap-4 pt-4 mt-auto">
      {currentStep > 1 && (
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
          {isContractor ? (
            // For contractors, show "Add a Business" button
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
  );
}

