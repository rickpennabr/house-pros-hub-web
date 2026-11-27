import Link from 'next/link';
import type { DocsPage } from '@/lib/docs/types';
import { docsBreadcrumbs } from '@/lib/docs/nav';
import { DocsFigure } from '@/components/docs/DocsFigure';

interface DocsArticleProps {
  page: DocsPage;
  locale: string;
}

export function DocsArticle({ page, locale }: DocsArticleProps) {
  const crumbs = docsBreadcrumbs(page.slug);

  return (
    <article className="min-w-0 w-full pt-2">
      <nav aria-label="Breadcrumb" className="mb-3 text-sm text-gray-500">
        <ol className="flex flex-wrap items-center gap-1">
          {crumbs.map((crumb, index) => (
            <li key={`${crumb.label}-${index}`} className="flex items-center gap-1">
              {index > 0 ? <span aria-hidden>/</span> : null}
              {crumb.href ? (
                <Link href={`/${locale}/docs`} className="hover:text-black">
                  {crumb.label}
                </Link>
              ) : (
                <span className={index === crumbs.length - 1 ? 'font-medium text-black' : undefined}>{crumb.label}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <div className="mb-4 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        {page.heroRole ? <DocsFigure role={page.heroRole} size="lg" /> : null}
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-black md:text-3xl">{page.title}</h1>
          <p className="mt-2 max-w-3xl text-base leading-relaxed text-gray-700">{page.lead}</p>
        </div>
      </div>

      <div className="mt-4 space-y-6">
        {page.sections.map((section) => (
          <section
            key={section.id}
            id={section.id}
            className="scroll-mt-24 rounded-lg border-2 border-black bg-white p-4 md:p-5"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <DocsFigure role={section.role} label={section.roleLabel} size="md" className="shrink-0 sm:mt-1" />
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold text-black md:text-xl">{section.title}</h2>
                <p className="mt-3 max-w-3xl text-base leading-relaxed text-gray-800">{section.story}</p>
                {section.steps && section.steps.length > 0 ? (
                  <ol className="mt-4 max-w-3xl list-decimal space-y-2 pl-5 text-sm leading-relaxed text-gray-700">
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
              </div>
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
