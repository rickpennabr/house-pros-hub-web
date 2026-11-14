import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import BusinessDetailsHeader from '@/components/businessdetails/BusinessDetailsHeader';
import { BlogBody } from '@/lib/blog/body';
import { formatBlogDate } from '@/lib/blog/format';
import { getPublishedBlogPost } from '@/lib/blog/queries';
import { absoluteUrl, jsonLdScript, localizedPath, resolveLocale } from '@/lib/seo/metadata';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale: localeParam, slug } = await params;
  const locale = resolveLocale(localeParam);
  const post = await getPublishedBlogPost(locale, slug);
  if (!post) {
    const t = await getTranslations({ locale, namespace: 'blog' });
    return { title: t('notFoundTitle') };
  }
  const canonicalLocale = post.locale === 'es' || post.locale === 'pt' || post.locale === 'en' ? post.locale : 'en';
  const cover = post.cover_image_url?.startsWith('https://') ? post.cover_image_url : undefined;
  return {
    title: post.title,
    description: post.excerpt,
    alternates:
      canonicalLocale !== locale
        ? { canonical: absoluteUrl(localizedPath(canonicalLocale, `/blog/${post.slug}`)) }
        : undefined,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      publishedTime: post.published_at ?? undefined,
      images: cover ? [{ url: cover, alt: post.title }] : undefined,
    },
  };
}

export default async function BlogArticlePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: localeParam, slug } = await params;
  const locale = resolveLocale(localeParam);
  const t = await getTranslations({ locale, namespace: 'blog' });
  const post = await getPublishedBlogPost(locale, slug);

  if (!post) notFound();

  const dateLabel = formatBlogDate(post.published_at, locale);
  const showCover = post.cover_image_url?.startsWith('https://') ?? false;
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    datePublished: post.published_at ?? undefined,
    dateModified: post.updated_at ?? post.published_at ?? undefined,
    inLanguage: locale,
    image: showCover ? post.cover_image_url : undefined,
    mainEntityOfPage: absoluteUrl(localizedPath(locale, `/blog/${post.slug}`)),
    author: { '@type': 'Organization', name: 'House Pros Hub' },
    publisher: { '@type': 'Organization', name: 'House Pros Hub' },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(articleJsonLd) }} />
      <BusinessDetailsHeader
        businessName={post.title}
        contractorType={t(post.category)}
        shareTitle={t('share')}
      />
      <article className="mx-auto w-full max-w-3xl px-3 py-4 md:px-4 md:pb-8">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-600">
        {t(post.category)}
        {' · '}
        {post.region}
        {dateLabel ? ` · ${dateLabel}` : ''}
      </p>
      <h1 className="mt-2 text-2xl font-bold leading-tight text-black md:text-3xl">{post.title}</h1>
      {post.excerpt && <p className="mt-3 text-base text-gray-700">{post.excerpt}</p>}
      {showCover && (
        <img
          src={post.cover_image_url ?? undefined}
          alt={post.title}
          className="mt-5 h-56 w-full rounded-lg border-2 border-black object-cover md:h-72"
        />
      )}
      <div className="mt-6">
        <BlogBody body={post.body} />
      </div>
      </article>
    </>
  );
}
