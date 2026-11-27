import Link from 'next/link';
import type { DocsPage } from '@/lib/docs/types';
import { docsBreadcrumbs } from '@/lib/docs/nav';

interface DocsArticleProps {
  page: DocsPage;
  locale: string;
}

export function DocsArticle({ page, locale }: DocsArticleProps) {
  const crumbs = docsBreadcrumbs(page.slug);

  return (
    <article className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-gray-500">
        <ol className="flex flex-wrap items-center gap-1">
          {crumbs.map((crumb, index) => (
            <li key={`${crumb.label}-${index}`} className="flex items-center gap-1">
              {index > 0 ? <span aria-hidden>/</span> : null}
              {crumb.href ? (
                <Link href={`/${locale}${crumb.href === '/docs' ? '/docs' : crumb.href}`} className="hover:text-black">
                  {crumb.label}
                </Link>
              ) : (
                <span className={index === crumbs.length - 1 ? 'text-gray-800' : undefined}>{crumb.label}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <h1 className="text-3xl font-bold tracking-tight text-black md:text-4xl">{page.title}</h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-gray-700 md:text-lg">{page.lead}</p>

      <div className="mt-8 space-y-10">
        {page.sections.map((section, index) => (
          <section key={section.id} id={section.id} className="scroll-mt-24">
            <div className="mb-3 border-t-2 border-black pt-6">
              <h2 className="text-xl font-semibold text-black md:text-2xl">
                <span className="mr-2 text-gray-400">{index + 1}</span>
                {section.title}
              </h2>
            </div>
            {section.paragraphs?.map((paragraph) => (
              <p key={paragraph.slice(0, 40)} className="mt-3 max-w-2xl text-base leading-relaxed text-gray-700">
                {paragraph}
              </p>
            ))}
            {section.steps && section.steps.length > 0 ? (
              <ol className="mt-4 max-w-2xl list-decimal space-y-2 pl-5 text-base leading-relaxed text-gray-800">
                {section.steps.map((step) => (
                  <li key={step.slice(0, 40)}>{step}</li>
                ))}
              </ol>
            ) : null}
            {section.links && section.links.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {section.links.map((link) => (
                  <Link
                    key={link.href}
                    href={`/${locale}${link.href}`}
                    className="inline-flex cursor-pointer items-center rounded-lg border-2 border-black bg-white px-3 py-2 text-sm font-medium text-black transition-colors hover:bg-gray-50"
                  >
                    {link.label} →
                  </Link>
                ))}
              </div>
            ) : null}
          </section>
        ))}
      </div>
    </article>
  );
}
