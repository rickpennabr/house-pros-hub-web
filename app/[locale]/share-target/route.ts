import { NextResponse } from 'next/server';
import type { Locale } from '@/i18n';

/**
 * Fallback for the installed app's share target.
 * The service worker normally stores the photo and redirects before this runs.
 */
function repairUrl(request: Request, locale: string): URL {
  const url = new URL(request.url);
  const host = request.headers.get('host');
  if (host) url.host = host;
  if (url.hostname === '0.0.0.0') url.hostname = 'localhost';
  url.pathname = `/${locale}/quick-repair`;
  url.search = '';
  return url;
}

export async function GET(request: Request, context: { params: Promise<{ locale: string }> }) {
  const { locale } = await context.params;
  return NextResponse.redirect(repairUrl(request, locale as Locale));
}

export async function POST(request: Request, context: { params: Promise<{ locale: string }> }) {
  const { locale } = await context.params;
  return NextResponse.redirect(repairUrl(request, locale as Locale), 303);
}
