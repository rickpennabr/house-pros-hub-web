'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { getReturnUrl, getRedirectPath } from '@/lib/redirect';

/**
 * Custom hook to handle authentication redirects
 * Automatically redirects authenticated users and provides redirect function
 * 
 * Note: This hook must be used inside a Suspense boundary because it uses useSearchParams()
 */
export function useAuthRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const { isAuthenticated, isLoading } = useAuth();

  // Automatically redirect if already authenticated (but not while still loading)
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      const returnUrl = getReturnUrl(searchParams);
      const redirectPath = getRedirectPath(returnUrl, locale as 'en' | 'es');
      router.push(redirectPath);
    }
  }, [isAuthenticated, isLoading, searchParams, router, locale]);

  /**
   * Redirect to the return URL or default path after authentication
   */
  const redirectAfterAuth = () => {
    const returnUrl = getReturnUrl(searchParams);
    const redirectPath = getRedirectPath(returnUrl, locale as 'en' | 'es');
    router.push(redirectPath);
  };

  return { redirectAfterAuth };
}

