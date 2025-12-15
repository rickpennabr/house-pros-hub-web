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
  // Show Add Business button on last step when terms are agreed and handler is provided
  const showAddBusiness = isLastStep && onAddBusiness && agreeToTerms;

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
            className="flex-1 whitespace-nowrap order-1 px-2 md:px-4 py-2 md:py-3"
          >
            {isLoading ? 'Creating account...' : 'Sign Up'}
          </Button>
          {showAddBusiness && (
            <button
              type="button"
              onClick={onAddBusiness}
              disabled={isLoading}
              className="flex-1 whitespace-nowrap order-2 font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed rounded-lg bg-red-600 text-white hover:bg-red-700 active:bg-red-800 border-2 border-red-600 px-2 md:px-4 py-2 md:py-3"
            >
              Add Business
            </button>
          )}
        </>
      )}
    </div>
  );
}

