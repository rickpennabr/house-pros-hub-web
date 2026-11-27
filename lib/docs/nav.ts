import type { DocsNavSection, DocsPage } from './types';
import { DOCS_PAGES } from './content';

/** Left-nav tree for Hub Docs. Pros first, then homeowners, then Help. */
export const DOCS_NAV: DocsNavSection[] = [
  {
    id: 'get-started',
    label: 'Get started',
    pages: [
      { slug: 'get-started/overview', title: 'Overview' },
      { slug: 'get-started/create-account', title: 'Create your account' },
      { slug: 'get-started/business-vs-personal', title: 'Business vs personal' },
    ],
  },
  {
    id: 'probot',
    label: 'ProBot',
    pages: [
      { slug: 'probot/chat', title: 'Chat with ProBot' },
      { slug: 'probot/voice', title: 'Voice notes' },
      { slug: 'probot/welcome-shortcuts', title: 'CRM shortcuts on welcome' },
    ],
  },
  {
    id: 'crm',
    label: 'CRM',
    pages: [
      { slug: 'crm/contacts', title: 'Contacts' },
      { slug: 'crm/estimates', title: 'Estimates' },
      { slug: 'crm/invoices', title: 'Invoices' },
      { slug: 'crm/projects', title: 'Projects' },
      { slug: 'crm/calendar', title: 'Calendar & schedule' },
      { slug: 'crm/expenses', title: 'Expenses' },
    ],
  },
  {
    id: 'homeowners',
    label: 'For homeowners',
    pages: [
      { slug: 'homeowners/find-a-pro', title: 'Find a pro' },
      { slug: 'homeowners/request-estimate', title: 'Request an estimate' },
      { slug: 'homeowners/my-places', title: 'My Places' },
    ],
  },
];

export const DOCS_DEFAULT_SLUG = 'get-started/overview';

export function docsPath(locale: string, slug?: string): string {
  if (!slug || slug === DOCS_DEFAULT_SLUG) return `/${locale}/docs`;
  return `/${locale}/docs/${slug}`;
}

export function findDocsPage(slug: string): DocsPage | undefined {
  return DOCS_PAGES.find((page) => page.slug === slug);
}

export function allDocsSlugs(): string[] {
  return DOCS_NAV.flatMap((section) => section.pages.map((page) => page.slug));
}

export function docsBreadcrumbs(slug: string): { label: string; href?: string }[] {
  for (const section of DOCS_NAV) {
    const page = section.pages.find((item) => item.slug === slug);
    if (!page) continue;
    return [
      { label: 'Docs', href: '/docs' },
      { label: section.label },
      { label: page.title },
    ];
  }
  return [{ label: 'Docs', href: '/docs' }];
}

export function filterDocsNav(query: string): DocsNavSection[] {
  const q = query.trim().toLowerCase();
  if (!q) return DOCS_NAV;
  return DOCS_NAV.map((section) => ({
    ...section,
    pages: section.pages.filter(
      (page) =>
        page.title.toLowerCase().includes(q) ||
        section.label.toLowerCase().includes(q) ||
        page.slug.toLowerCase().includes(q)
    ),
  })).filter((section) => section.pages.length > 0);
}
