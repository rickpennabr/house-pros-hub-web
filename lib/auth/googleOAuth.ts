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

/** nip.io keeps the dotted IP as labels: 192.168.0.25.nip.io */
export function lanHostnameViaNip(hostname: string): string {
  return `${hostname}.nip.io`;
}

export function oauthFriendlyCandidates(
  location: Pick<Location, 'protocol' | 'hostname' | 'port'>
): string[] {
  const port = location.port ? `:${location.port}` : '';
  if (!isPrivateLanHostname(location.hostname)) {
    return [`${location.protocol}//${location.hostname}${port}`];
  }
  return [
    `${location.protocol}//${lanHostnameViaSslip(location.hostname)}${port}`,
    `${location.protocol}//${lanHostnameViaNip(location.hostname)}${port}`,
  ];
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

/**
 * Probe whether the phone can resolve+reach a LAN hostname mirror.
 * Avoids navigating into Chrome's ERR_NAME_NOT_RESOLVED screen.
 */
export async function pickReachableLanOrigin(candidates: string[]): Promise<string | null> {
  for (const origin of candidates) {
    try {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 2500);
      await fetch(`${origin}/favicon.ico`, {
        method: 'GET',
        mode: 'no-cors',
        cache: 'no-store',
        signal: controller.signal,
      });
      window.clearTimeout(timer);
      return origin;
    } catch {
      // try next candidate (DNS failure, timeout, offline)
    }
  }
  return null;
}

/** Dev API + static sslip/nip candidates. `.local` often works when public DNS blocks sslip. */
async function lanHopCandidates(location: Location): Promise<string[]> {
  const fromPage = oauthFriendlyCandidates(location);
  try {
    const res = await fetch('/api/dev/lan-hosts', { cache: 'no-store' });
    if (!res.ok) return fromPage;
    const body = (await res.json()) as { origins?: string[] };
    const fromServer = Array.isArray(body.origins) ? body.origins : [];
    return [...new Set([...fromServer, ...fromPage])];
  } catch {
    return fromPage;
  }
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
  | {
      ok: false;
      error: 'redirect_to_lan' | 'redirect_not_allowlisted' | 'oauth_start_failed' | 'lan_hostname_unreachable';
      message: string;
      friendlyUrl?: string;
    };

/**
 * Quiet entry used after a LAN → hostname hop (BrazaLink-style).
 * Keeps PKCE + cookies on the hostname origin without reloading sign-in UI.
 */
export function googleStartPath(
  locale: string,
  flow: GoogleOAuthFlow,
  returnUrl?: string | null
): string {
  const params = new URLSearchParams({ flow });
  if (returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//')) {
    params.set('returnUrl', returnUrl);
  }
  return `/${locale}/auth/google-start?${params.toString()}`;
}

/**
 * Starts Google OAuth and keeps the return hop on this origin.
 * On a phone using a LAN IP, hops to a reachable sslip.io / nip.io hostname
 * first so Google never sees a raw IP redirectTo.
 */
export async function startGoogleOAuth(input: {
  flow: GoogleOAuthFlow;
  locale: string;
  returnUrl?: string | null;
}): Promise<StartGoogleOAuthResult> {
  const { origin, switchedFromIp } = oauthFriendlyOrigin(window.location);
  if (switchedFromIp) {
    // Docs: Supabase Auth rejects raw IP redirectTo and falls back to Site URL
    // (production). Google also rejects raw IPs as Authorized JavaScript origins.
    // Hop to a hostname the phone can resolve (.local / sslip / nip).
    const candidates = await lanHopCandidates(window.location);
    const reachable = await pickReachableLanOrigin(candidates);
    if (!reachable) {
      const suggested = candidates[0] || oauthFriendlyCandidates(window.location)[0];
      return {
        ok: false,
        error: 'lan_hostname_unreachable',
        message: suggested
          ? `Google cannot finish on a raw phone IP, and this phone could not resolve ${suggested}. Your router's DNS is probably blocking hostnames that point at LAN addresses (DNS rebinding protection). Set the phone's DNS to dns.google / 8.8.8.8, or open the Hub through a tunnel URL (NEXT_PUBLIC_DEV_LAN_ORIGIN).`
          : 'Google cannot finish on a raw phone IP. Open the Hub with a hostname URL on the same Wi‑Fi, not 192.168.x.x.',
        friendlyUrl: suggested,
      };
    }
    stashGoogleOAuthResume(input.flow);
    const next = new URL(
      `${reachable}${googleStartPath(input.locale, input.flow, input.returnUrl ?? null)}`
    );
    window.location.assign(next.toString());
    return {
      ok: false,
      error: 'redirect_to_lan',
      message:
        'Google sign-in cannot return to a raw phone IP. Opening this page on a local hostname instead.',
      friendlyUrl: reachable,
    };
  }

  setOauthCookies(input.flow, input.locale, input.returnUrl ?? null);

  const redirectTo = `${origin}/api/auth/callback?locale=${encodeURIComponent(input.locale)}&flow=${input.flow}`;
  const supabase = createClient();
  try {
    // Same as BrazaLink google-start: drop stale local cookies before PKCE.
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    // Continue — OAuth start still needs to run.
  }
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: { prompt: 'select_account' },
    },
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
