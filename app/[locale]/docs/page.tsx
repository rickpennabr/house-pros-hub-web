import { getLocale, getTranslations } from 'next-intl/server';
import { DocsShell } from '@/components/docs/DocsShell';
import { DocsArticle } from '@/components/docs/DocsArticle';
import { DOCS_DEFAULT_SLUG, findDocsPage } from '@/lib/docs/nav';
import { notFound } from 'next/navigation';

export default async function DocsHomePage() {
  const locale = await getLocale();
  const t = await getTranslations('docs');
  const page = findDocsPage(DOCS_DEFAULT_SLUG);
  if (!page) notFound();

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
