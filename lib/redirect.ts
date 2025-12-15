import { ReadonlyURLSearchParams } from 'next/navigation';

/**
 * Creates a sign-in URL with a return URL parameter
 * @param pathname - The current pathname to return to after sign-in
 * @returns The sign-in URL with returnUrl query parameter
 */
export function createSignInUrl(pathname: string): string {
  const returnUrl = encodeURIComponent(pathname);
  return `/signin?returnUrl=${returnUrl}`;
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
 * Gets the redirect path from a return URL
 * Validates the return URL and provides a safe default
 * @param returnUrl - The return URL to validate
 * @returns The redirect path (returnUrl if valid, '/' otherwise)
 */
export function getRedirectPath(returnUrl: string | null): string {
  if (!returnUrl) {
    return '/';
  }

  // Decode the return URL
  try {
    const decoded = decodeURIComponent(returnUrl);
    
    // Basic validation: ensure it's a relative path (starts with /)
    // This prevents open redirect vulnerabilities
    if (decoded.startsWith('/') && !decoded.startsWith('//')) {
      return decoded;
    }
  } catch (error) {
    console.error('Error decoding return URL:', error);
  }

  // Default to home if returnUrl is invalid
  return '/';
}

