import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { BlogList } from '@/components/blog/BlogList';
import { listPublishedBlogPosts } from '@/lib/blog/queries';
import { locales, type Locale } from '@/i18n';

function resolveLocale(value: string): Locale {
  return locales.includes(value as Locale) ? (value as Locale) : 'en';
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: resolveLocale(locale), namespace: 'blog' });
  return {
    title: t('title'),
    description: t('subtitle'),
  };
}

export default async function BlogPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: localeParam } = await params;
  const locale = resolveLocale(localeParam);
  const t = await getTranslations({ locale, namespace: 'blog' });
  const { posts, unavailable } = await listPublishedBlogPosts(locale);

  return (
    <div className="px-1 pb-6 md:px-2">
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-black">{t('title')}</h1>
        <p className="mt-1 text-sm text-gray-700">{t('subtitle')}</p>
      </header>

      <BlogList posts={posts} locale={locale} unavailable={unavailable} />
    </div>
  );
}
