'use client';

import type { DocsHeading } from '@/lib/docs/types';

interface DocsTocProps {
  headings: DocsHeading[];
  title: string;
}

export function DocsToc({ headings, title }: DocsTocProps) {
  if (headings.length === 0) return null;

  return (
    <aside className="hidden w-56 shrink-0 xl:block">
      <div className="sticky top-20 px-2 py-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</p>
        <ul className="space-y-2 border-l-2 border-gray-200 pl-3">
          {headings.map((heading) => (
            <li key={heading.id}>
              <a
                href={`#${heading.id}`}
                className="block text-sm text-gray-600 transition-colors hover:text-black"
              >
                {heading.title}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
