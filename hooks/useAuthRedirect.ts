'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getReturnUrl, getRedirectPath } from '@/lib/redirect';

/**
 * Custom hook to handle authentication redirects
 * Automatically redirects authenticated users and provides redirect function
 */
export function useAuthRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuth();

  // Automatically redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const returnUrl = getReturnUrl(searchParams);
      const redirectPath = getRedirectPath(returnUrl);
      router.push(redirectPath);
    }
  }, [isAuthenticated, searchParams, router]);

  /**
   * Redirect to the return URL or default path after authentication
   */
  const redirectAfterAuth = () => {
    const returnUrl = getReturnUrl(searchParams);
    const redirectPath = getRedirectPath(returnUrl);
    router.push(redirectPath);
  };

  return { redirectAfterAuth };
}

