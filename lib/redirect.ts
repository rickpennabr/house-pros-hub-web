import { ReadonlyURLSearchParams } from 'next/navigation';
import { Locale } from '@/i18n';

/**
 * Creates a locale-aware path
 * @param locale - The current locale
 * @param path - The path (with or without leading slash)
 * @returns The path with locale prefix
 */
export function createLocalePath(locale: Locale, path?: string | null): string {
  const safePath = path ?? '/';
  // Remove leading slash if present
  const cleanPath = safePath.startsWith('/') ? safePath.slice(1) : safePath;
  // Remove locale prefix if already present
  const pathWithoutLocale = cleanPath.startsWith(`${locale}/`) 
    ? cleanPath.replace(`${locale}/`, '')
    : cleanPath.startsWith('en/') || cleanPath.startsWith('es/')
    ? cleanPath.split('/').slice(1).join('/')
    : cleanPath;
  return pathWithoutLocale ? `/${locale}/${pathWithoutLocale}` : `/${locale}`;
}

/**
 * Creates a sign-in URL with a return URL parameter and locale
 * @param locale - The current locale
 * @param pathname - The current pathname to return to after sign-in
 * @returns The sign-in URL with returnUrl query parameter and locale prefix
 */
export function createSignInUrl(locale: Locale, pathname?: string | null): string {
  const returnUrl = encodeURIComponent(createLocalePath(locale, pathname));
  return `/${locale}/signin?returnUrl=${returnUrl}`;
}

/**
 * Extracts the return URL from search parameters
 * @param searchParams - The URL search parameters
 * @returns The return URL if present, null otherwise
 */
export function getReturnUrl(searchParams: ReadonlyURLSearchParams): string | null {
  return searchParams.get('returnUrl');
}

/**
 * Creates a sign-up URL with a return URL parameter and locale
 * @param locale - The current locale
 * @param pathname - The current pathname to return to after sign-up
 * @returns The sign-up URL with returnUrl query parameter and locale prefix
 */
export function createSignUpUrl(locale: Locale, pathname?: string | null): string {
  const returnUrl = encodeURIComponent(createLocalePath(locale, pathname));
  return `/${locale}/signup?returnUrl=${returnUrl}`;
}

/**
 * Gets the redirect path from a return URL, preserving locale
 * Validates the return URL and provides a safe default
 * @param returnUrl - The return URL to validate
 * @param locale - The current locale (optional, will extract from returnUrl if present)
 * @returns The redirect path with locale prefix
 */
export function getRedirectPath(returnUrl: string | null, locale?: Locale): string {
  if (!returnUrl) {
    // Default to home page (which redirects to businesslist)
    return locale ? `/${locale}` : '/en';
  }

  // Decode the return URL
  try {
    const decoded = decodeURIComponent(returnUrl);
    
    // Basic validation: ensure it's a relative path (starts with /)
    // This prevents open redirect vulnerabilities
    if (decoded.startsWith('/') && !decoded.startsWith('//')) {
      // If returnUrl already has locale prefix, use it
      if (decoded.startsWith('/en/') || decoded.startsWith('/es/')) {
        return decoded;
      }
      // Otherwise, add locale prefix if provided
      if (locale) {
        return createLocalePath(locale, decoded);
      }
      // Default to English if no locale provided
      return `/en${decoded}`;
    }
  } catch (error) {
    console.error('Error decoding return URL:', error);
  }

  // Default to home page if returnUrl is invalid
  return locale ? `/${locale}` : '/en';
}

