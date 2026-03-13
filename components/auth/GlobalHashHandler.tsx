'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { locales } from '@/i18n';

function getLocaleFromPathname(pathname: string): string {
  const segment = pathname.split('/')[1];
  return segment && (locales as readonly string[]).includes(segment) ? segment : 'en';
}

/**
 * When Supabase redirects with hash fragments (access_token, refresh_token, type=recovery)
 * to the site root or another page, redirect to the locale reset-password page with the hash
 * so the reset-password page can set the session and show the form.
 */
export function GlobalHashHandler() {
  const pathname = usePathname();
  const [hasRedirected, setHasRedirected] = useState(false);

  useEffect(() => {
    if (hasRedirected) return;
    if (pathname?.includes('reset-password')) return;

    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    if (!hash || hash.length === 0) return;

    try {
      const hashParams = new URLSearchParams(hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const type = hashParams.get('type');

      if (accessToken && refreshToken && type === 'recovery') {
        const locale = getLocaleFromPathname(pathname || window.location.pathname);
        setHasRedirected(true);
        window.location.replace(`/${locale}/reset-password${hash}`);
      }
    } catch (error) {
      console.error('Error parsing hash fragments:', error);
    }
  }, [pathname, hasRedirected]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkHash = () => {
      if (hasRedirected || pathname?.includes('reset-password')) return;

      const hash = window.location.hash;
      if (!hash || hash.length === 0) return;

      try {
        const hashParams = new URLSearchParams(hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type');

        if (accessToken && refreshToken && type === 'recovery') {
          const locale = getLocaleFromPathname(window.location.pathname);
          setHasRedirected(true);
          window.location.replace(`/${locale}/reset-password${hash}`);
        }
      } catch (error) {
        console.error('Error parsing hash fragments on mount:', error);
      }
    };

    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, [pathname, hasRedirected]);

  return null;
}
