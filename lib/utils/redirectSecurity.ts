/**
 * Server-safe redirect URL validation to prevent open redirects.
 * Used in auth callback for recovery and OAuth redirects.
 */

/**
 * Checks if a session is a recovery session (password reset flow).
 * Supabase may redirect to callback with only ?code= and without type=recovery,
 * so we detect recovery from the session after code exchange.
 */
export function isRecoverySession(session: {
  user?: { user_metadata?: Record<string, unknown>; app_metadata?: Record<string, unknown> };
  type?: string;
} | null): boolean {
  if (!session?.user) return false;
  const userMetadata = session.user.user_metadata ?? {};
  const appMetadata = session.user.app_metadata ?? {};
  return (
    (userMetadata as Record<string, unknown>).recovery === true ||
    (appMetadata as Record<string, unknown>).recovery === true ||
    session.type === 'recovery'
  );
}

/**
 * Validates that a redirect URL is same-origin or a relative path.
 */
function isValidRedirectUrl(redirectUrl: string, allowedOrigin: string): boolean {
  try {
    if (!redirectUrl || !redirectUrl.trim()) return false;
    if (redirectUrl.startsWith('/')) return true;
    const url = new URL(redirectUrl, allowedOrigin);
    const allowed = new URL(allowedOrigin);
    return (
      url.protocol === allowed.protocol &&
      url.hostname === allowed.hostname &&
      url.port === allowed.port
    );
  } catch {
    return false;
  }
}

/**
 * Returns a safe redirect URL or null if invalid.
 * Relative paths (starting with /) are allowed; absolute URLs must be same origin.
 */
export function sanitizeRedirectUrl(
  redirectUrl: string | null,
  allowedOrigin: string
): string | null {
  if (!redirectUrl || !redirectUrl.trim()) return null;
  if (redirectUrl.startsWith('/')) return redirectUrl;
  return isValidRedirectUrl(redirectUrl, allowedOrigin) ? redirectUrl : null;
}
