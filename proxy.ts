/**
 * Proxy for next-intl internationalization routing, Supabase session refresh,
 * and a double-submit CSRF check on API writes.
 *
 * - Supabase: refreshes auth session (getUser) so cookies stay in sync.
 * - next-intl: locale detection and routing for all non-admin routes.
 * - CSRF: page responses set a readable cookie; mutating /api requests must echo it.
 */
import createMiddleware from 'next-intl/middleware';
import { locales } from './i18n';
import { NextRequest, NextResponse } from 'next/server';
import { createClient, sessionClaims, sessionNeedsRefresh } from '@/lib/supabase/middleware';
import {
  ADMIN_MFA_PATH,
  TWO_STEP_SEGMENT,
  adminEmailFromEnv,
  adminMfaEnforced,
  allowedBeforeAdminMfa,
} from '@/lib/auth/admin-mfa';
import { userHasTwoStep } from '@/lib/auth/two-step';

const CSRF_COOKIE = 'hph_csrf';
const CSRF_HEADER = 'x-hph-csrf';
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale: 'en',
  localePrefix: 'always',
});

function newCsrfToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function tokensMatch(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

function ensureCsrfCookie(request: NextRequest, response: NextResponse): NextResponse {
  if (!request.cookies.get(CSRF_COOKIE)?.value) {
    response.cookies.set(CSRF_COOKIE, newCsrfToken(), {
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });
  }
  return response;
}

function csrfRejected(): NextResponse {
  return NextResponse.json({ error: 'CSRF token is required' }, { status: 403 });
}

function apiCsrfResult(request: NextRequest): NextResponse | null {
  const pathname = request.nextUrl.pathname;
  if (!pathname.startsWith('/api') || pathname.startsWith('/api/webhooks/')) return null;
  // Agent calls authenticate with a bearer key. They do not have the browser CSRF cookie.
  if (pathname.startsWith('/api/agent/') || pathname === '/api/mcp' || pathname.startsWith('/api/mcp/')) {
    return null;
  }
  // Stripe signs the body. It does not send the browser CSRF cookie.
  if (pathname === '/api/stripe/webhook' || pathname.startsWith('/api/cron/')) {
    return null;
  }
  if (!MUTATING.has(request.method.toUpperCase())) return null;

  const cookie = request.cookies.get(CSRF_COOKIE)?.value ?? '';
  const header = request.headers.get(CSRF_HEADER) ?? '';
  if (!cookie || !header || !tokensMatch(cookie, header)) return csrfRejected();
  return null;
}

function withSeoHeaders(request: NextRequest): NextRequest {
  const headers = new Headers(request.headers);
  const pathname = request.nextUrl.pathname;
  const segment = pathname.split('/')[1] ?? '';
  const locale = (locales as readonly string[]).includes(segment) ? segment : 'en';
  headers.set('x-hph-locale', locale);
  headers.set('x-hph-pathname', pathname);
  headers.set('x-hph-search', request.nextUrl.search);
  return new NextRequest(request, { headers });
}

/**
 * Two-step sign-in. The admin account always needs it; anyone else needs it once they turned it on
 * (Account management > Settings). Until the code is entered in this session (aal2), only the
 * code page, sign-in pages and auth APIs work. See lib/auth/admin-mfa.ts and lib/auth/two-step.ts.
 */
async function twoStepResult(request: NextRequest): Promise<NextResponse | null> {
  const pathname = request.nextUrl.pathname;
  if (allowedBeforeAdminMfa(pathname)) return null;
  const claims = sessionClaims(request);
  if (!claims || claims.aal === 'aal2' || !claims.userId) return null;
  const adminEmail = adminEmailFromEnv();
  const isAdmin = Boolean(adminEmail) && claims.email === adminEmail;
  const required = isAdmin ? adminMfaEnforced() : await userHasTwoStep(claims.userId);
  if (!required) return null;
  if (pathname.startsWith('/api')) {
    return NextResponse.json(
      { error: 'Finish two-step sign-in first.', code: isAdmin ? 'admin_mfa_required' : 'two_step_required' },
      { status: 401 }
    );
  }
  const url = request.nextUrl.clone();
  const segment = pathname.split('/')[1] ?? '';
  const locale = (locales as readonly string[]).includes(segment) ? segment : 'en';
  url.pathname = isAdmin ? ADMIN_MFA_PATH : `/${locale}/${TWO_STEP_SEGMENT}`;
  url.search = `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export default async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const mfaBlocked = await twoStepResult(request);
  if (mfaBlocked) return mfaBlocked;
  const seoRequest = withSeoHeaders(request);

  if (pathname.startsWith('/api')) {
    const rejected = apiCsrfResult(request);
    if (rejected) return rejected;
    return ensureCsrfCookie(request, NextResponse.next());
  }

  // /q/:code is the printed short link. next-intl would prefix /en and that path 404s.
  // /en/q/:code (and es, pt) is rewritten back so a scan still counts and redirects.
  const localizedQr = pathname.match(new RegExp(`^/(${locales.join('|')})/q/([^/]+)/?$`));
  let response: NextResponse;
  if (localizedQr) {
    const url = request.nextUrl.clone();
    url.pathname = `/q/${localizedQr[2]}`;
    response = NextResponse.rewrite(url, { request: { headers: seoRequest.headers } });
  } else if (pathname.startsWith('/admin') || pathname.startsWith('/q/')) {
    response = NextResponse.next({ request: { headers: seoRequest.headers } });
  } else {
    response = intlMiddleware(seoRequest);
  }

  // getUser() exists only to rotate an expiring session cookie. A still-valid
  // access token does not need a round trip to Supabase on every page view.
  if (sessionNeedsRefresh(request)) {
    const supabase = createClient(request, response);
    await supabase.auth.getUser();
  }

  return ensureCsrfCookie(request, response);
}

export const config = {
  matcher: ['/((?!_next|_vercel|.*\\..*).*)'],
};
