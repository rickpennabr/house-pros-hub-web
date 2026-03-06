import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { Database } from '@/lib/types/supabase';
import { logger } from '@/lib/utils/logger';

/**
 * GET /api/auth/callback
 * Handles OAuth and PKCE-based auth flows. For password reset (recovery), the forgot-password
 * API sends an email link that points here. Supabase redirects with ?code=...; we exchange
 * the code for a session, set cookies, and redirect to /[locale]/reset-password. The reset
 * page then relies on getSession() (cookies) only — no hash tokens.
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const locale = requestUrl.searchParams.get('locale') || 'en';

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
    logger.info('[Auth Callback] redirecting to reset-password with error', { message });
    return NextResponse.redirect(
      new URL(`/${locale}/reset-password?error=${encodeURIComponent(message)}`, normalizedBaseUrl)
    );
  }

  if (code) {
    const successRedirectUrl = new URL(`/${locale}/reset-password`, normalizedBaseUrl);
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
      return NextResponse.redirect(
        new URL(`/${locale}/reset-password?error=${encodeURIComponent(message)}`, normalizedBaseUrl)
      );
    }

    if (exchangeData?.user ?? exchangeData?.session) {
      logger.info('[Auth Callback] exchangeCodeForSession ok, redirecting to reset-password', {
        redirectPath: successRedirectUrl.pathname,
      });
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
