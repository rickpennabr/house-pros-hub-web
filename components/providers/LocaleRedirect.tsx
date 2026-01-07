'use client';

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import type { Locale } from '@/i18n';

/**
 * Component that redirects authenticated users to their preferred locale
 * if it differs from the current locale.
 * 
 * This ensures users see the site in their preferred language even when
 * accessing from a different browser/device.
 */
export default function LocaleRedirect() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const currentLocale = useLocale() as Locale;
  const hasRedirected = useRef(false);

  useEffect(() => {
    // Only redirect if:
    // 1. User is authenticated
    // 2. Not currently loading
    // 3. User has a preferred locale set
    // 4. Preferred locale differs from current locale
    // 5. Haven't already redirected in this session
    if (
      isAuthenticated &&
      !isLoading &&
      user?.preferredLocale &&
      user.preferredLocale !== currentLocale &&
      !hasRedirected.current
    ) {
      hasRedirected.current = true;

      // Remove current locale from pathname
      let pathWithoutLocale = pathname;
      if (pathname.startsWith(`/${currentLocale}`)) {
        pathWithoutLocale = pathname.replace(`/${currentLocale}`, '') || '/';
      } else if (pathname.startsWith('/en/') || pathname.startsWith('/es/')) {
        pathWithoutLocale = '/' + pathname.split('/').slice(2).join('/') || '/';
      }

      // Navigate to preferred locale
      const newPath = `/${user.preferredLocale}${pathWithoutLocale}`;
      router.push(newPath);
    }
  }, [isAuthenticated, isLoading, user?.preferredLocale, currentLocale, pathname, router]);

  return null;
}

