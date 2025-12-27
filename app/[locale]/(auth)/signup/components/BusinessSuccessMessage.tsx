'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { createLocalePath } from '@/lib/redirect';
import type { Locale } from '@/i18n';
import { useAuth } from '@/contexts/AuthContext';

// Success message component displayed after successful business creation

interface BusinessSuccessMessageProps {
  onAllowNavigation?: () => void;
}

export function BusinessSuccessMessage({ onAllowNavigation }: BusinessSuccessMessageProps) {
  const router = useRouter();
  const locale = useLocale() as Locale;
  const { checkAuth } = useAuth();
  const [businessId, setBusinessId] = useState<string | null>(null);

  // Get the newly created business ID from sessionStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const id = sessionStorage.getItem('newlyCreatedBusinessId');
      if (id) {
        setBusinessId(id);
        // Clear it after reading so it doesn't persist
        sessionStorage.removeItem('newlyCreatedBusinessId');
      }
    }
  }, []);

  const handleManageBusiness = () => {
    // Allow navigation without warning
    onAllowNavigation?.();
    // Navigate with business ID as query parameter if available
    const path = businessId 
      ? `${createLocalePath(locale, '/account-management')}?businessId=${businessId}`
      : createLocalePath(locale, '/account-management');
    router.push(path);
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
    <div className="space-y-6 flex-1 flex flex-col min-h-[400px]">
      <div className="flex-1 flex flex-col justify-center">
        <div className="bg-white border-2 border-black rounded-lg p-6 h-full flex flex-col justify-center text-center">
          <svg
            className="w-16 h-16 mx-auto text-green-600 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h2 className="text-2xl font-semibold mb-4">
            Congratulations!
          </h2>
          <p className="text-gray-700 mb-2">
            Your business has been successfully added to HouseProsHub.
          </p>
          <p className="text-base md:text-lg text-gray-600">
            We wish you the best of luck with your business!
          </p>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-4 w-full">
        <Button
          type="button"
          variant="primary"
          onClick={handleManageBusiness}
          className="flex-1 whitespace-nowrap px-2 md:px-4 py-2 md:py-3"
        >
          Manage Business
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={handleGoHome}
          className="flex-1 whitespace-nowrap px-2 md:px-4 py-2 md:py-3"
        >
          Go to Home
        </Button>
      </div>
    </div>
  );
}

