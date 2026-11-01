import type { NextRequest } from 'next/server';

/**
 * Hostname browsers cannot navigate to; dev servers often bind to 0.0.0.0 but links must use localhost.
 */
function normalizeOriginForEmailLinks(origin: string): string {
  try {
    const u = new URL(origin);
    if (u.hostname === '0.0.0.0') {
      u.hostname = 'localhost';
    }
    return u.origin;
  } catch {
    return origin.replace(/\/$/, '');
  }
}

/**
 * Public site base URL for links emailed to customers (estimate/invoice view, etc.).
 * Prefer NEXT_PUBLIC_APP_URL; otherwise use the request origin. Replaces 0.0.0.0 with localhost.
 */
export function getPublicSiteUrlForEmail(request: NextRequest): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) {
    return normalizeOriginForEmailLinks(fromEnv);
  }
  return normalizeOriginForEmailLinks(request.nextUrl.origin);
}
