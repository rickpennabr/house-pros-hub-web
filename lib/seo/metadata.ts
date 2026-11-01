import type { Metadata } from 'next';
import { locales, type Locale } from '@/i18n';
import { siteOrigin } from '@/lib/agent/constants';
import { directoryPath, sanitizeDirectoryCategory, sanitizeDirectoryCity } from '@/lib/data/directoryParams';

export function absoluteUrl(path: string): string {
  const origin = siteOrigin().replace(/\/$/, '');
  if (!path || path === '/') return origin;
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${origin}${suffix}`;
}

export function localizedPath(locale: string, path: string): string {
  const [pathname, query] = path.split('?');
  const normalized = !pathname || pathname === '/' ? '' : pathname.startsWith('/') ? pathname : `/${pathname}`;
  const base = normalized ? `/${locale}${normalized}` : `/${locale}`;
  return query ? `${base}?${query}` : base;
}

const PRIVATE_PREFIXES = [
  '/crm',
  '/signin',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/account-management',
  '/prodrive',
  '/saved-businesses',
  '/business/add',
  '/business/edit',
  '/profile/edit',
  '/partners/manage',
  '/invoices',
  '/estimates',
  '/mapview',
];

export function isPrivatePath(path: string): boolean {
  return PRIVATE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/** Profile, product, and installer bodies are the same in every locale. */
export function isUntranslatedEntity(path: string): boolean {
  return (
    /^\/business\/[^/]+$/.test(path) ||
    /^\/proproducts\/[^/]+$/.test(path) ||
    /^\/installers\/[^/]+$/.test(path)
  );
}

export function pathWithoutLocale(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return '';
  if ((locales as readonly string[]).includes(parts[0])) {
    return parts.length > 1 ? `/${parts.slice(1).join('/')}` : '';
  }
  return `/${parts.join('/')}`;
}

export function resolveLocale(value: string | null | undefined): Locale {
  return locales.includes(value as Locale) ? (value as Locale) : 'en';
}

function indexablePath(pathname: string, search: string): string {
  const bare = pathWithoutLocale(pathname);
  const base = bare === '' ? '/businesslist' : bare;
  if (base !== '/businesslist') return base;
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return directoryPath(sanitizeDirectoryCategory(params.get('category')), sanitizeDirectoryCity(params.get('city')));
}

export function alternatesFor(
  locale: string,
  pathname: string,
  search: string
): Metadata['alternates'] | undefined {
  const bare = pathWithoutLocale(pathname);
  const resolved = bare === '' ? '/businesslist' : bare;
  if (isPrivatePath(resolved)) return undefined;
  if (isUntranslatedEntity(resolved)) {
    return { canonical: absoluteUrl(localizedPath('en', resolved)) };
  }

  const path = indexablePath(pathname, search);
  const languages: Record<string, string> = {};
  for (const item of locales) {
    languages[item] = absoluteUrl(localizedPath(item, path));
  }
  languages['x-default'] = absoluteUrl(localizedPath('en', path));
  return {
    canonical: absoluteUrl(localizedPath(resolveLocale(locale), path)),
    languages,
  };
}

export const privateRobots: Metadata['robots'] = {
  index: false,
  follow: false,
  googleBot: { index: false, follow: false },
};

export const publicRobots: Metadata['robots'] = {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    'max-video-preview': -1,
    'max-image-preview': 'large',
    'max-snippet': -1,
  },
};

export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
