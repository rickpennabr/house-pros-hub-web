'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { USER_TYPES, type UserType } from '@/lib/constants/auth';
import { createLocalePath, getRedirectPath } from '@/lib/redirect';
import { useAuth } from '@/contexts/AuthContext';

// Success message component displayed after successful signup

interface SignupSuccessMessageProps {
  userType?: UserType;
  onAddBusiness?: () => void | Promise<void>;
  /** If present (e.g. from signup?returnUrl=...), used for "Get Free Estimate" and preferred redirect */
  returnUrl?: string | null;
}

export function SignupSuccessMessage({ userType, onAddBusiness, returnUrl }: SignupSuccessMessageProps) {
  const router = useRouter();
  const locale = useLocale() as 'en' | 'es';
  const { checkAuth } = useAuth();
  const [isNavigating, setIsNavigating] = useState(false);
  const isBusinessSignup = userType === USER_TYPES.CONTRACTOR;
  const isCustomerSignup = userType === USER_TYPES.CUSTOMER;

  /** path can be locale-prefixed (e.g. /en/estimate) or relative (e.g. /estimate) */
  const ensureAuthAndNavigate = async (path: string) => {
    if (isNavigating) return;

    setIsNavigating(true);

    const targetPath =
      path.startsWith('/en/') || path.startsWith('/es/') ? path : createLocalePath(locale, path);

    try {
      const maxRetries = 3;
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const checkAuthPromise = checkAuth();
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Auth check timeout')), 5000)
          );
          await Promise.race([checkAuthPromise, timeoutPromise]);
          await new Promise((resolve) => setTimeout(resolve, 300));
          break;
        } catch (authError) {
          const msg = authError instanceof Error ? authError.message : 'Unknown auth error';
          console.warn(`Auth check attempt ${attempt + 1}/${maxRetries} failed:`, msg);
          if (attempt < maxRetries - 1) {
            await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
          }
        }
      }

      // Final refresh with timeout so we never hang (fixes stuck "Loading..." after API signup)
      try {
        const finalCheck = checkAuth();
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 2000)
        );
        await Promise.race([finalCheck, timeout]);
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch {
        // Navigate anyway; destination will handle auth
      }

      router.push(targetPath);
    } catch (error) {
      console.error('Error navigating:', error);
      router.push(targetPath);
    } finally {
      setTimeout(() => setIsNavigating(false), 500);
    }
  };

  const handleGoToHome = () => {
    void ensureAuthAndNavigate('/');
  };

  const estimatePath = returnUrl
    ? getRedirectPath(returnUrl, locale)
    : createLocalePath(locale, '/estimate');

  const handleGetEstimate = () => {
    void ensureAuthAndNavigate(estimatePath);
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
            Thanks for signing up for House Pros Hub!
          </h2>
          <p className="text-gray-700">
            {isBusinessSignup
              ? "Welcome to House Pros Hub! Your business account has been created. You can now manage your business profile and connect with customers."
              : "Now you can contact your pro or request your free estimate."}
          </p>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-4 w-full">
        {isCustomerSignup ? (
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={handleGoToHome}
              disabled={isNavigating}
              className="flex-1 whitespace-nowrap px-2 md:px-4 py-2 md:py-3"
            >
              {isNavigating ? 'Loading...' : 'Go to Home'}
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleGetEstimate}
              disabled={isNavigating}
              className="flex-1 whitespace-nowrap px-2 md:px-4 py-2 md:py-3"
            >
              {isNavigating ? 'Loading...' : 'Get Free Estimate'}
            </Button>
          </>
        ) : (
          <>
            <Button
              type="button"
              variant="primary"
              onClick={() => router.push(createLocalePath(locale as 'en' | 'es', '/account-management'))}
              className="flex-1 whitespace-nowrap px-2 md:px-4 py-2 md:py-3"
            >
              Manage Account
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleGoToHome}
              disabled={isNavigating}
              className="flex-1 whitespace-nowrap px-2 md:px-4 py-2 md:py-3"
            >
              {isNavigating ? 'Loading...' : 'Go to Home'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

