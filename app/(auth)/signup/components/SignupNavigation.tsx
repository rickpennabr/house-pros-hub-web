'use client';

import { Button } from '@/components/ui/Button';

interface SignupNavigationProps {
  currentStep: number;
  totalSteps: number;
  isLoading: boolean;
  agreeToTerms: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onAddBusiness?: () => void;
}

export function SignupNavigation({
  currentStep,
  totalSteps,
  isLoading,
  agreeToTerms,
  onPrevious,
  onNext,
  onAddBusiness,
}: SignupNavigationProps) {
  const isLastStep = currentStep === totalSteps;
  // Note: Add Business button is NOT shown during signup form
  // It only appears on the success screen after signup is complete
  // This prevents the error of trying to add business before user is created
  const showAddBusiness = false; // Always false - button only on success screen

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
          Previous
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
          Next
        </Button>
      ) : (
        <>
          <Button
            type="submit"
            variant="primary"
            disabled={isLoading || !agreeToTerms}
            className={`flex-1 whitespace-nowrap px-2 md:px-4 py-2 md:py-3 ${
              agreeToTerms && !isLoading ? 'bg-black text-white' : ''
            }`}
          >
            {isLoading ? 'Creating account...' : 'Sign Up'}
          </Button>
        </>
      )}
    </div>
  );
}

