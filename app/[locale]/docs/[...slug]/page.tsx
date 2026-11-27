import { getLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { DocsShell } from '@/components/docs/DocsShell';
import { DocsArticle } from '@/components/docs/DocsArticle';
import { allDocsSlugs, findDocsPage } from '@/lib/docs/nav';

interface DocsSlugPageProps {
  params: Promise<{ slug: string[] }>;
}

export function generateStaticParams() {
  return allDocsSlugs().map((slug) => ({ slug: slug.split('/') }));
}

export default async function DocsSlugPage({ params }: DocsSlugPageProps) {
  const { slug: parts } = await params;
  const slug = parts.join('/');
  const page = findDocsPage(slug);
  if (!page) notFound();

  const locale = await getLocale();
  const t = await getTranslations('docs');

  return (
    <DocsShell
      locale={locale}
      activeSlug={page.slug}
      pageTitle={page.title}
      headings={page.sections.map((section) => ({ id: section.id, title: section.title }))}
      labels={{
        brand: t('brand'),
        backToHub: t('backToHub'),
        search: t('search'),
        clear: t('clear'),
        menu: t('menu'),
        close: t('close'),
        help: t('help'),
        onThisPage: t('onThisPage'),
      }}
    >
      <DocsArticle page={page} locale={locale} />
    </DocsShell>
  );
}
