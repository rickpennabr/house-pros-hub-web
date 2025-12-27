'use client';

import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { useAuth } from '@/contexts/AuthContext';
import { useLocale } from 'next-intl';
import { createLocalePath } from '@/lib/redirect';
import type { Locale } from '@/i18n';

interface BusinessSuccessModalProps {
  isOpen: boolean;
  onGoHome: () => void;
  onManageBusiness: () => void;
  onAllowNavigation?: () => void;
}

export function BusinessSuccessModal({
  isOpen,
  onGoHome,
  onManageBusiness,
  onAllowNavigation,
}: BusinessSuccessModalProps) {
  const { checkAuth } = useAuth();
  const locale = useLocale() as Locale;

  const handleManageBusiness = () => {
    // Allow navigation without warning
    onAllowNavigation?.();
    onManageBusiness();
  };

  const handleGoHome = async () => {
    // Allow navigation without warning
    onAllowNavigation?.();
    // Refresh auth state to ensure user appears as signed in
    await checkAuth();
    // Force a full page refresh to ensure the user appears as signed in on home page
    window.location.href = createLocalePath(locale, '/');
  };

  return (
    <ConfirmationModal
      isOpen={isOpen}
      onClose={handleGoHome}
      title="Congratulations!"
      message={
        <>
          <p className="mb-2">
            Your business has been successfully added to HouseProsHub.
          </p>
          <p className="text-base md:text-lg text-gray-600">
            We wish you the best of luck with your business!
          </p>
        </>
      }
      primaryButton={{
        label: 'Manage Business',
        onClick: handleManageBusiness,
      }}
      secondaryButton={{
        label: 'Go to Home',
        onClick: handleGoHome,
      }}
    />
  );
}

