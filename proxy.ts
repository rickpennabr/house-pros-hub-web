/**
 * Proxy for next-intl internationalization routing and Supabase session refresh.
 *
 * - Supabase: refreshes auth session (getUser) so cookies stay in sync for API routes and Server Components.
 * - next-intl: locale detection and routing for all non-admin routes.
 */
import createMiddleware from 'next-intl/middleware';
import { locales } from './i18n';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/middleware';

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale: 'en',
  localePrefix: 'always',
});

export default async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Exclude /admin routes from locale routing - let them pass through without locale processing
  if (pathname.startsWith('/admin')) {
    return NextResponse.next();
  }

  // Refresh Supabase session so cookies stay in sync for /api/auth/me and Server Components
  const { supabase, response: supabaseResponse } = createClient(request);
  await supabase.auth.getUser();

  // Run next-intl for locale handling
  const intlResponse = intlMiddleware(request);

  // Apply Supabase auth cookies to the response (intl and auth both apply)
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    intlResponse.cookies.set(cookie.name, cookie.value);
  });

  return intlResponse;
}

export const config = {
  // Match all pathnames except for:
  // - Routes starting with `/api`, `/_next` or `/_vercel`
  // - Routes containing a dot (e.g. `favicon.ico`, static files)
  // - Routes starting with `/admin` (handled separately, no locale prefix)
  matcher: ['/((?!api|_next|_vercel|admin|.*\\..*).*)']
};
