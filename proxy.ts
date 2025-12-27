/**
 * Proxy for next-intl internationalization routing (Next.js 16+).
 *
 * Next.js 16 deprecated `middleware.ts` in favor of `proxy.ts`.
 * next-intl's request-locale resolution relies on this request interception.
 */
import createMiddleware from 'next-intl/middleware';
import { locales } from './i18n';
import { NextRequest, NextResponse } from 'next/server';

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale: 'en',
  localePrefix: 'always'
});

export default function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // Exclude /admin routes from locale routing - let them pass through without locale processing
  if (pathname.startsWith('/admin')) {
    return NextResponse.next();
  }
  
  // All other routes go through next-intl middleware for locale handling
  return intlMiddleware(request);
}

export const config = {
  // Match all pathnames except for:
  // - Routes starting with `/api`, `/_next` or `/_vercel`
  // - Routes containing a dot (e.g. `favicon.ico`, static files)
  // - Routes starting with `/admin` (handled separately, no locale prefix)
  matcher: ['/((?!api|_next|_vercel|admin|.*\\..*).*)']
};
