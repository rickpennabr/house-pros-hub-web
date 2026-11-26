'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Camera, MapPin } from 'lucide-react';
import { TypingSearchInput } from '@/components/common/TypingSearchInput';

interface ProjectRow {
  id: string;
  name: string;
  display_id?: string;
  status: string;
  customer_id?: string | null;
  customerDisplayName?: string | null;
  customerAddress?: string | null;
  propertyName?: string | null;
  propertyAddress?: string | null;
}

interface CustomerGroup {
  key: string;
  name: string;
  projects: ProjectRow[];
}

/** Jobsite: projects grouped by customer; each one shows the property it is at (customers can have several). */
export default function JobsiteIndexPage() {
  const t = useTranslations('jobsite');
  const locale = useLocale();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    void fetch('/api/crm/projects?pageSize=100', { credentials: 'include' })
      .then((response) => response.json())
      .then((body: { projects?: ProjectRow[]; error?: string }) => {
        if (body.error) setError(body.error);
        setProjects(body.projects ?? []);
      })
      .catch(() => setError(t('loadFailed')));
  }, [t]);

  const groups = useMemo((): CustomerGroup[] => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const map = new Map<string, CustomerGroup>();
    for (const project of projects) {
      const where = project.propertyAddress || project.customerAddress || '';
      const text = `${project.name} ${project.customerDisplayName ?? ''} ${project.propertyName ?? ''} ${where}`.toLowerCase();
      if (words.length && !words.every((word) => text.includes(word))) continue;
      const key = project.customer_id || '__none';
      const group = map.get(key) ?? { key, name: project.customerDisplayName || 'No customer', projects: [] };
      group.projects.push(project);
      map.set(key, group);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [projects, query]);

  return (
    <div className="space-y-3 p-4">
      <h1 className="text-xl font-bold">{t('title')}</h1>
      <TypingSearchInput
        value={query}
        onChange={setQuery}
        placeholder="Search by customer, project or address"
        clearLabel="Clear search"
        className="relative w-full"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      {groups.map((group) => (
        <section key={group.key} className="space-y-2">
          <h2 className="pt-2 text-sm font-bold uppercase tracking-wide text-gray-600">
            {group.name}
            {group.projects.length > 1 ? <span className="ml-1 font-normal normal-case">· {group.projects.length} jobs</span> : null}
          </h2>
          <ul className="space-y-2">
            {group.projects.map((project) => {
              const where = project.propertyAddress || project.customerAddress;
              return (
                <li key={project.id}>
                  <Link
                    href={`/${locale}/crm/projects/${project.id}/photos`}
                    className="flex items-center justify-between gap-3 rounded-lg border-2 border-black px-3 py-2 hover:bg-gray-50"
                  >
                    <span className="min-w-0">
                      <span className="block font-medium">{project.name}</span>
                      {project.propertyName || where ? (
                        <span className="flex items-start gap-1 text-xs text-gray-600">
                          <MapPin className="mt-0.5 h-3 w-3 shrink-0 text-red-600" aria-hidden />
                          <span className="break-words">
                            {[project.propertyName, where].filter(Boolean).join(' · ')}
                          </span>
                        </span>
                      ) : null}
                    </span>
                    <span className="flex shrink-0 items-center gap-1 text-sm underline">
                      <Camera className="h-4 w-4" aria-hidden />
                      {t('open')}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      {!error && projects.length > 0 && groups.length === 0 ? (
        <p className="text-sm text-gray-500">No match for “{query.trim()}”.</p>
      ) : null}
    </div>
  );
}
