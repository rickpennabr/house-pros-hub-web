import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { Database } from '@/lib/types/supabase';
import { logger } from '@/lib/utils/logger';
import { locales, type Locale } from '@/i18n';
import { provisionGoogleCustomer } from '@/lib/auth/googleCustomer';
import { isGoogleAccountConflict } from '@/lib/auth/googleAccount';

function safeLocale(value: string | null): Locale {
  return locales.includes(value as Locale) ? (value as Locale) : 'en';
}

function safeAppPath(value: string | null, locale: string): string {
  if (!value) return `/${locale}`;
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return `/${locale}`;
  }
  if (!decoded.startsWith('/') || decoded.startsWith('//') || decoded.includes('\\') || decoded.includes('://')) {
    return `/${locale}`;
  }
  return decoded;
}

/**
 * The header Free Estimate button stores the estimate page as the return path.
 * A signup started from the profile icon has no return path, so a brand-new
 * account lands on the thanks screen instead.
 */
function customerDestination(
  nextPath: string,
  locale: string,
  flow: string,
  kind: 'new' | 'existing'
): string {
  if (nextPath.includes('/estimate')) return nextPath;
  if (flow === 'customer' && kind === 'new' && nextPath === `/${locale}`) {
    return `/${locale}/signup/success?role=customer`;
  }
  return nextPath;
}

function clearOauthCookies(response: NextResponse) {
  const expired = { path: '/', maxAge: 0 };
  response.cookies.set('hph_oauth_flow', '', expired);
  response.cookies.set('hph_oauth_locale', '', expired);
  response.cookies.set('hph_oauth_next', '', expired);
}

/**
 * GET /api/auth/callback
 * Handles OAuth and PKCE-based auth flows. For password reset (recovery), the forgot-password
 * API sends an email link that points here. Supabase redirects with ?code=...; we exchange
 * the code for a session, set cookies, and redirect to /[locale]/reset-password. The reset
 * page then relies on getSession() (cookies) only — no hash tokens.
 *
 * Customer Google sign-up uses the same exchange, then assigns the customer role and
 * sends the person to their return path. Contractor, realtor, and installer accounts
 * are not created here.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const flow = requestUrl.searchParams.get('flow') || request.cookies.get('hph_oauth_flow')?.value || '';
  const isSignInGoogle = flow === 'signin';
  const isCustomerGoogle = flow === 'customer' || isSignInGoogle;
  const locale = safeLocale(
    requestUrl.searchParams.get('locale') || request.cookies.get('hph_oauth_locale')?.value || 'en'
  );

  logger.info('[Auth Callback] GET', {
    path: requestUrl.pathname,
    codePresent: !!code,
    codeLength: code?.length ?? 0,
    locale,
    hasErrorParam: !!requestUrl.searchParams.get('error'),
  });

  // Normalize base URL - convert 0.0.0.0 to localhost for redirects
  let baseUrl = request.url;
  if (baseUrl.includes('0.0.0.0')) {
    baseUrl = baseUrl.replace('0.0.0.0', 'localhost');
  }
  const normalizedBaseUrl = new URL(baseUrl);

  // Supabase writes the new session while we exchange the code. Those cookies have to
  // ride on whatever response we return: dropping them on a failure path leaves the
  // person holding a session the Auth server already issued but the browser never saw.
  const sessionCookies: { name: string; value: string; options: CookieOptions }[] = [];

  function redirect(path: string, keepSession = true): NextResponse {
    const response = NextResponse.redirect(new URL(path, normalizedBaseUrl));
    if (keepSession) {
      for (const cookie of sessionCookies) {
        response.cookies.set(cookie.name, cookie.value, { ...cookie.options, path: '/' });
      }
    }
    if (isCustomerGoogle) clearOauthCookies(response);
    return response;
  }

  // Handle Supabase error query params (e.g. link expired)
  const errorParam = requestUrl.searchParams.get('error');
  const errorCode = requestUrl.searchParams.get('error_code');
  const errorDescription = requestUrl.searchParams.get('error_description');
  if (errorParam || errorCode) {
    const message = errorDescription || errorParam || 'Link expired or invalid';
    // Closing the Google window is a choice, not a failure. Send them back to a clean form.
    if (isCustomerGoogle && errorParam === 'access_denied') {
      logger.info('[Auth Callback] Google sign-in cancelled by the person');
      return redirect(isSignInGoogle ? `/${locale}/signin` : `/${locale}/signup?role=customer`);
    }
    const accountConflict = isCustomerGoogle && isGoogleAccountConflict(errorCode, errorDescription);
    const errorPath = accountConflict
      ? `/${locale}/signin?error=existing_account`
      : isSignInGoogle
        ? `/${locale}/signin?error=${encodeURIComponent('Could not sign in with Google')}`
        : isCustomerGoogle
          ? `/${locale}/signup?role=customer&error=${encodeURIComponent('Could not sign up with Google')}`
          : `/${locale}/reset-password?error=${encodeURIComponent(message)}`;
    logger.info('[Auth Callback] redirecting with error', { message, isCustomerGoogle });
    return redirect(errorPath);
  }

  if (code) {
    const nextPath = safeAppPath(request.cookies.get('hph_oauth_next')?.value ?? null, locale);
    const successPath = isCustomerGoogle ? nextPath : `/${locale}/reset-password`;
    const failPath = isSignInGoogle
      ? `/${locale}/signin?error=${encodeURIComponent('Could not sign in with Google')}`
      : isCustomerGoogle
        ? `/${locale}/signup?role=customer&error=${encodeURIComponent('Could not sign up with Google')}`
        : `/${locale}/reset-password?error=${encodeURIComponent('Link expired or invalid')}`;

    const cookieStore = await cookies();
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            sessionCookies.push(...cookiesToSet);
          },
        },
      }
    );

    const { data: exchangeData, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      // The code is single use. A second callback request for the same code — a double
      // click on the Google button, a browser retry, the back button — lands here after
      // the first request already signed the person in. Finish on the session they have
      // instead of showing an error they cannot act on.
      const { data: current } = await supabase.auth.getUser();
      if (current.user) {
        logger.info('[Auth Callback] code already used, session from the first request is valid', {
          userId: current.user.id,
        });
        return redirect(successPath);
      }

      logger.error('[Auth Callback] exchangeCodeForSession failed', { error: error.message });
      if (error.message?.toLowerCase().includes('verifier') || error.message?.toLowerCase().includes('code_verifier')) {
        logger.info('[Auth Callback] PKCE hint: open the reset link in the SAME browser where you requested the reset.');
      }
      const message = error.message || 'Link expired or invalid';
      return redirect(
        isCustomerGoogle ? failPath : `/${locale}/reset-password?error=${encodeURIComponent(message)}`
      );
    }

    if (exchangeData?.user ?? exchangeData?.session) {
      let accountKind: 'new' | 'existing' = 'existing';
      if (isCustomerGoogle && exchangeData.user) {
        try {
          accountKind = await provisionGoogleCustomer(exchangeData.user);
        } catch (provisionError) {
          logger.error('[Auth Callback] Google customer provisioning failed', {
            error: provisionError instanceof Error ? provisionError.message : 'unknown',
          });
          // Do not hand out a session for an account we could not finish setting up,
          // otherwise the error page redirects itself away a moment later.
          return redirect(failPath, false);
        }
      }
      const landing = isCustomerGoogle
        ? customerDestination(nextPath, locale, flow, accountKind)
        : successPath;
      logger.info('[Auth Callback] exchangeCodeForSession ok', {
        redirectPath: landing,
        isCustomerGoogle,
        accountKind,
      });
      return redirect(landing);
    }

    logger.info('[Auth Callback] exchange ok but no user/session, redirecting to signin');
    return redirect(`/${locale}/signin?error=${encodeURIComponent('Authentication failed')}`);
  }

  logger.info('[Auth Callback] no code param, redirecting to signin');
  return redirect(`/${locale}/signin?error=${encodeURIComponent('No authentication code provided')}`);
}
