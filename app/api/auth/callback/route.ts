import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { Database } from '@/lib/types/supabase';
import { logger } from '@/lib/utils/logger';
import { locales, type Locale } from '@/i18n';
import { provisionGoogleCustomer } from '@/lib/auth/googleCustomer';

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

  // Handle Supabase error query params (e.g. link expired)
  const errorParam = requestUrl.searchParams.get('error');
  const errorCode = requestUrl.searchParams.get('error_code');
  const errorDescription = requestUrl.searchParams.get('error_description');
  if (errorParam || errorCode) {
    const message = errorDescription || errorParam || 'Link expired or invalid';
    const errorPath = isSignInGoogle
      ? `/${locale}/signin?error=${encodeURIComponent('Could not sign in with Google')}`
      : isCustomerGoogle
        ? `/${locale}/signup?role=customer&error=${encodeURIComponent('Could not sign up with Google')}`
        : `/${locale}/reset-password?error=${encodeURIComponent(message)}`;
    logger.info('[Auth Callback] redirecting with error', { message, isCustomerGoogle });
    const errorResponse = NextResponse.redirect(new URL(errorPath, normalizedBaseUrl));
    if (isCustomerGoogle) clearOauthCookies(errorResponse);
    return errorResponse;
  }

  if (code) {
    const nextPath = safeAppPath(request.cookies.get('hph_oauth_next')?.value ?? null, locale);
    const successRedirectUrl = new URL(
      isCustomerGoogle ? nextPath : `/${locale}/reset-password`,
      normalizedBaseUrl
    );
    const redirectResponse = NextResponse.redirect(successRedirectUrl);

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
            cookiesToSet.forEach(({ name, value, options }) =>
              redirectResponse.cookies.set(name, value, { ...options, path: '/' })
            );
          },
        },
      }
    );

    const { data: exchangeData, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      logger.error('[Auth Callback] exchangeCodeForSession failed', { error: error.message });
      if (error.message?.toLowerCase().includes('verifier') || error.message?.toLowerCase().includes('code_verifier')) {
        logger.info('[Auth Callback] PKCE hint: open the reset link in the SAME browser where you requested the reset.');
      }
      const message = error.message || 'Link expired or invalid';
      const failPath = isSignInGoogle
        ? `/${locale}/signin?error=${encodeURIComponent('Could not sign in with Google')}`
        : isCustomerGoogle
          ? `/${locale}/signup?role=customer&error=${encodeURIComponent('Could not sign up with Google')}`
          : `/${locale}/reset-password?error=${encodeURIComponent(message)}`;
      const failResponse = NextResponse.redirect(new URL(failPath, normalizedBaseUrl));
      if (isCustomerGoogle) clearOauthCookies(failResponse);
      return failResponse;
    }

    if (exchangeData?.user ?? exchangeData?.session) {
      if (isCustomerGoogle && exchangeData.user) {
        try {
          await provisionGoogleCustomer(exchangeData.user);
        } catch (provisionError) {
          logger.error('[Auth Callback] Google customer provisioning failed', {
            error: provisionError instanceof Error ? provisionError.message : 'unknown',
          });
          const failResponse = NextResponse.redirect(
            new URL(
              isSignInGoogle
                ? `/${locale}/signin?error=${encodeURIComponent('Could not sign in with Google')}`
                : `/${locale}/signup?role=customer&error=${encodeURIComponent('Could not sign up with Google')}`,
              normalizedBaseUrl
            )
          );
          clearOauthCookies(failResponse);
          return failResponse;
        }
      }
      logger.info('[Auth Callback] exchangeCodeForSession ok', {
        redirectPath: successRedirectUrl.pathname,
        isCustomerGoogle,
      });
      if (isCustomerGoogle) clearOauthCookies(redirectResponse);
      return redirectResponse;
    }

    logger.info('[Auth Callback] exchange ok but no user/session, redirecting to signin');
    return NextResponse.redirect(
      new URL(`/${locale}/signin?error=${encodeURIComponent('Authentication failed')}`, normalizedBaseUrl)
    );
  }

  logger.info('[Auth Callback] no code param, redirecting to signin');
  return NextResponse.redirect(
    new URL(`/${locale}/signin?error=${encodeURIComponent('No authentication code provided')}`, normalizedBaseUrl)
  );
}
