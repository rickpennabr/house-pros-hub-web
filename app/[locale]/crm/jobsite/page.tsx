'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';

interface ProjectRow {
  id: string;
  name: string;
  display_id?: string;
  status: string;
}

export default function JobsiteIndexPage() {
  const t = useTranslations('jobsite');
  const locale = useLocale();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch('/api/crm/projects?pageSize=100', { credentials: 'include' })
      .then((response) => response.json())
      .then((body: { projects?: ProjectRow[]; error?: string }) => {
        if (body.error) setError(body.error);
        setProjects(body.projects ?? []);
      })
      .catch(() => setError(t('loadFailed')));
  }, [t]);

  return (
    <div className="p-4 space-y-3">
      <h1 className="text-xl font-bold">{t('title')}</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <ul className="space-y-2">
        {projects.map((project) => (
          <li key={project.id} className="border-2 border-black rounded-lg px-3 py-2 flex items-center justify-between gap-2">
            <span className="font-medium">{project.name}</span>
            <Link className="underline text-sm" href={`/${locale}/crm/projects/${project.id}/photos`}>{t('open')}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
