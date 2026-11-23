import type { NextRequest } from 'next/server';

/** The live site. Links in customer emails fall back to it on production. */
export const PRODUCTION_SITE_URL = 'https://houseproshub.com';

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

/** Addresses a customer can't open from an email: this computer, the home network, or a raw Vercel deploy URL. */
export function isNonPublicOrigin(origin: string): boolean {
  let host: string;
  try {
    host = new URL(origin).hostname.toLowerCase();
  } catch {
    return true;
  }
  return (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host.endsWith('.local') ||
    host.endsWith('.vercel.app') ||
    host.endsWith('.nip.io') ||
    host.endsWith('.sslip.io') ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  );
}

type SiteEnv = Partial<Record<string, string | undefined>>;

/** True on the live Vercel deployment (not preview, not local). */
function isProductionDeploy(env: SiteEnv): boolean {
  return env.VERCEL_ENV === 'production';
}

/**
 * Base URL for links sent to customers (invoice and estimate links, reminders, receipts).
 * Order: NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_SITE_URL, then the request's own address.
 * On production a localhost, home-network or *.vercel.app value is skipped, and the last
 * fallback is houseproshub.com, so an email never carries a link the customer can't open.
 * Elsewhere (local dev, previews) the first value found is used, so links point at that copy.
 */
export function resolvePublicSiteUrl(requestOrigin?: string | null, env: SiteEnv = process.env): string {
  const candidates = [env.NEXT_PUBLIC_APP_URL, env.NEXT_PUBLIC_SITE_URL, requestOrigin]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .map(normalizeOriginForEmailLinks);
  if (isProductionDeploy(env)) {
    return candidates.find((origin) => !isNonPublicOrigin(origin)) ?? PRODUCTION_SITE_URL;
  }
  return candidates[0] ?? PRODUCTION_SITE_URL;
}

/** Public site base URL for links emailed to customers, from an API route. */
export function getPublicSiteUrlForEmail(request: NextRequest): string {
  return resolvePublicSiteUrl(request.nextUrl.origin);
}
