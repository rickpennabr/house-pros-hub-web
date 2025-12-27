import { getRequestConfig } from 'next-intl/server';

export const locales = ['en', 'es'] as const;
export type Locale = (typeof locales)[number];

export default getRequestConfig(async ({ locale }) => {
  // In dev (and with changing Next.js interception runtimes), locale inference can
  // occasionally fail. Fall back to the default locale instead of hard-404ing.
  const resolvedLocale: Locale = locales.includes(locale as Locale) ? (locale as Locale) : 'en';

  return {
    locale: resolvedLocale,
    messages: (await import(`./messages/${resolvedLocale}/index.json`)).default
  };
});
