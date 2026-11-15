import { createClient } from '@/lib/supabase/client';

export type GoogleOAuthFlow = 'signin' | 'customer';

const RESUME_KEY = 'hph_google_oauth_resume';

/** True for LAN / private hosts phones use to reach a local Next server. */
export function isPrivateLanHostname(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '127.0.0.1') return false;
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
    const [a, b] = hostname.split('.').map(Number);
    if (a === 10) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }
  return false;
}

/**
 * Supabase Auth ignores raw IP redirectTo values and falls back to the project
 * Site URL (production). sslip.io turns the same LAN address into a hostname
 * so the allow list can match, e.g. http://192-168-0-25.sslip.io:3000/**
 */
export function lanHostnameViaSslip(hostname: string): string {
  return `${hostname.replace(/\./g, '-')}.sslip.io`;
}

export function oauthFriendlyOrigin(location: Pick<Location, 'protocol' | 'hostname' | 'port'>): {
  origin: string;
  switchedFromIp: boolean;
  friendlyUrl?: string;
} {
  const port = location.port ? `:${location.port}` : '';
  if (!isPrivateLanHostname(location.hostname)) {
    return { origin: `${location.protocol}//${location.hostname}${port}`, switchedFromIp: false };
  }
  const host = lanHostnameViaSslip(location.hostname);
  const origin = `${location.protocol}//${host}${port}`;
  return { origin, switchedFromIp: true, friendlyUrl: origin };
}

function setOauthCookies(flow: GoogleOAuthFlow, locale: string, returnUrl: string | null) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `hph_oauth_flow=${flow}; Path=/; Max-Age=600; SameSite=Lax${secure}`;
  document.cookie = `hph_oauth_locale=${encodeURIComponent(locale)}; Path=/; Max-Age=600; SameSite=Lax${secure}`;
  if (returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//')) {
    document.cookie = `hph_oauth_next=${encodeURIComponent(returnUrl)}; Path=/; Max-Age=600; SameSite=Lax${secure}`;
  } else {
    document.cookie = 'hph_oauth_next=; Path=/; Max-Age=0; SameSite=Lax';
  }
}

export function stashGoogleOAuthResume(flow: GoogleOAuthFlow) {
  try {
    sessionStorage.setItem(RESUME_KEY, flow);
  } catch {
    // Private mode can block storage; the ?google= query still works.
  }
}

export function takeGoogleOAuthResume(): GoogleOAuthFlow | null {
  try {
    const value = sessionStorage.getItem(RESUME_KEY);
    sessionStorage.removeItem(RESUME_KEY);
    if (value === 'signin' || value === 'customer') return value;
  } catch {
    // ignore
  }
  return null;
}

export type StartGoogleOAuthResult =
  | { ok: true }
  | { ok: false; error: 'redirect_to_lan' | 'redirect_not_allowlisted' | 'oauth_start_failed'; message: string; friendlyUrl?: string };

/**
 * Starts Google OAuth and keeps the return hop on this origin.
 * On a phone using a LAN IP, sends the browser to the sslip.io hostname first.
 */
export async function startGoogleOAuth(input: {
  flow: GoogleOAuthFlow;
  locale: string;
  returnUrl?: string | null;
}): Promise<StartGoogleOAuthResult> {
  const { origin, switchedFromIp, friendlyUrl } = oauthFriendlyOrigin(window.location);
  if (switchedFromIp && friendlyUrl) {
    stashGoogleOAuthResume(input.flow);
    const next = new URL(`${friendlyUrl}${window.location.pathname}${window.location.search}`);
    next.searchParams.set('google', input.flow);
    if (input.returnUrl) next.searchParams.set('returnUrl', input.returnUrl);
    window.location.assign(next.toString());
    return {
      ok: false,
      error: 'redirect_to_lan',
      message:
        'Google sign-in cannot return to a raw phone IP. Opening this page on a local hostname instead.',
      friendlyUrl,
    };
  }

  setOauthCookies(input.flow, input.locale, input.returnUrl ?? null);

  const redirectTo = `${origin}/api/auth/callback?locale=${encodeURIComponent(input.locale)}&flow=${input.flow}`;
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });

  if (error || !data.url) {
    return {
      ok: false,
      error: 'oauth_start_failed',
      message: error?.message || 'Could not start Google sign-in',
    };
  }

  // If redirectTo was rejected, Supabase rewrites redirect_to to the Site URL
  // (houseproshub.com). Stop before the browser leaves local.
  let returnedRedirect: string | null = null;
  try {
    returnedRedirect = new URL(data.url).searchParams.get('redirect_to');
  } catch {
    returnedRedirect = null;
  }
  if (returnedRedirect) {
    try {
      const returnedOrigin = new URL(returnedRedirect).origin;
      if (returnedOrigin !== origin) {
        return {
          ok: false,
          error: 'redirect_not_allowlisted',
          message: `Supabase would send Google back to ${returnedOrigin} instead of ${origin}. Add ${origin}/** under Authentication → URL Configuration → Redirect URLs.`,
        };
      }
    } catch {
      // If redirect_to is malformed, still try the authorize URL.
    }
  }

  window.location.assign(data.url);
  return { ok: true };
}
