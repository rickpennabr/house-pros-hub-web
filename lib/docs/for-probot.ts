import { DOCS_PAGES } from './content';
import { DOCS_NAV, docsPath } from './nav';

/**
 * Compact Hub Docs digest for ProBot's system prompt.
 * Facts about how the Hub works — not about any one customer's CRM data.
 */
export function hubDocsBrief(locale = 'en'): string {
  const lines: string[] = [
    'Hub Docs (how the product works). Use this when they ask how to use the Hub, ProBot, CRM, or My Places. Point them to the matching /docs page. Do not invent CRM counts or names from this guide.',
  ];

  for (const section of DOCS_NAV) {
    lines.push(`${section.label}:`);
    for (const page of section.pages) {
      const full = DOCS_PAGES.find((item) => item.slug === page.slug);
      if (!full) continue;
      const path = docsPath(locale, page.slug);
      const beats = full.sections.map((beat) => beat.title).join('; ');
      lines.push(`- ${page.title} (${path}): ${full.lead} Topics: ${beats}.`);
    }
  }

  lines.push('Help & Support FAQ/contact: /help. Full guides: /docs.');
  return lines.join('\n');
}
