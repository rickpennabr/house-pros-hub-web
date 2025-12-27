'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { createSignInUrl } from '@/lib/redirect';

/**
 * Custom hook for protected actions
 * Checks authentication status before executing an action
 * Redirects to signin if not authenticated
 */
export function useProtectedAction<T extends (...args: unknown[]) => void | Promise<void>>(
  action: T
): T {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();

  const protectedAction = ((...args: Parameters<T>) => {
    // If still loading auth state, don't do anything
    if (isLoading) {
      return;
    }

    // If not authenticated, redirect to signin with returnUrl
    if (!isAuthenticated) {
      const signInUrl = createSignInUrl(locale as 'en' | 'es', pathname);
      router.push(signInUrl);
      return;
    }

    // If authenticated, execute the action
    return action(...args);
  }) as T;

  return protectedAction;
}

