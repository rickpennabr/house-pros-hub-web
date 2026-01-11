/**
 * Admin configuration constants
 */

/**
 * Admin email address for authorization
 * Must be configured via ADMIN_EMAIL environment variable
 * 
 * In production, throws error if not set to prevent security issues.
 * In development, uses a fallback but logs a warning.
 * On the client side, returns a sentinel value that will never match.
 */
export const ADMIN_EMAIL = (() => {
  // On client side, environment variables without NEXT_PUBLIC_ prefix are not available
  // Return a sentinel value that will never match any email address
  if (typeof window !== 'undefined') {
    return '__CLIENT_SIDE_PLACEHOLDER__';
  }
  
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (!email) {
    if (isProduction) {
      // In production, fail fast - this is a critical security requirement
      throw new Error(
        'ADMIN_EMAIL environment variable is required in production. ' +
        'Please set it in your environment variables.'
      );
    } else {
      // In development, use a fallback but warn the developer
      const fallback = 'admin@example.com';
      console.warn(
        '⚠️  WARNING: ADMIN_EMAIL environment variable is not set.\n' +
        `   Using fallback: ${fallback}\n` +
        '   This fallback will NOT work in production.\n' +
        '   Please set ADMIN_EMAIL in your .env.local file.'
      );
      return fallback;
    }
  }
  
  return email;
})();

