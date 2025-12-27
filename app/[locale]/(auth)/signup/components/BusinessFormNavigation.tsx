'use client';

import { Button } from '@/components/ui/Button';
import { useTranslations } from 'next-intl';

interface BusinessFormNavigationProps {
  currentStep: number;
  totalSteps: number;
  isLoading: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onSubmit: () => void;
}

export function BusinessFormNavigation({
  currentStep,
  totalSteps,
  isLoading,
  onPrevious,
  onNext,
  onSubmit,
}: BusinessFormNavigationProps) {
  const t = useTranslations('businessForm.navigation');

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
        <Button
          type="button"
          variant="primary"
          onClick={onSubmit}
          disabled={isLoading}
          className="flex-1 whitespace-nowrap px-2 md:px-4 py-2 md:py-3"
        >
          {isLoading ? t('finishing') : t('finish')}
        </Button>
      )}
    </div>
  );
}

