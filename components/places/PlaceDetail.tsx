'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import type { PlaceBundle } from '@/lib/places/portal';

function money(cents: number) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function formatDay(iso: string | null) {
  if (!iso) return '—';
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return iso;
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function PlaceDetail({ placeId }: { placeId: string }) {
  const t = useTranslations('places');
  const locale = useLocale();
  const [bundle, setBundle] = useState<PlaceBundle | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/places/${placeId}`, { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setBundle(data as PlaceBundle);
      })
      .catch(() => setError(t('loadFailed')));
  }, [placeId, t]);

  if (error) return <div className="p-4 md:p-6 text-red-600">{error}</div>;
  if (!bundle) return <div className="p-4 md:p-6 text-gray-500">{t('loading')}</div>;

  const address = [bundle.place.street, bundle.place.city, bundle.place.state, bundle.place.zipCode]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="p-4 md:p-6 space-y-6">
      <Link href={`/${locale}/myplaces`} className="text-sm text-red-600 font-medium">
        {t('back')}
      </Link>
      <div>
        <p className="text-xs uppercase tracking-wide text-gray-500">{t(`kind.${bundle.place.kind}`)}</p>
        <h2 className="text-2xl font-semibold">{bundle.place.name}</h2>
        {address ? <p className="text-sm text-gray-700 mt-1">{address}</p> : null}
      </div>

      <section className="border-2 border-black rounded-lg p-4 space-y-4">
        <h2 className="font-semibold">{t('projects')}</h2>
        {bundle.projects.length === 0 ? <p className="text-sm text-gray-600">{t('noProjects')}</p> : null}
        {bundle.projects.map((project) => (
          <article key={project.id} className="border border-black rounded-lg p-3 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-medium">{project.name}</h3>
                <p className="text-xs text-gray-600">
                  {t('with')} {project.proName} · {t(`status.${project.status}`)}
                </p>
              </div>
              <p className="text-xs text-gray-600 whitespace-nowrap">
                {formatDay(project.startDate)} – {formatDay(project.endDate)}
              </p>
            </div>
            {project.phases.length > 0 ? (
              <ol className="space-y-2">
                <li className="text-xs font-medium text-gray-500">{t('plan')}</li>
                {project.phases.map((phase, index) => (
                  <li key={phase.id} className="text-sm flex gap-2">
                    <span className="w-5 shrink-0 text-gray-500">{index + 1}.</span>
                    <span>
                      <span className="font-medium">{phase.name}</span>
                      <span className="text-gray-600"> · {t(`status.${phase.status}`)}</span>
                      <span className="block text-xs text-gray-600">
                        {formatDay(phase.startDate)} – {formatDay(phase.endDate)}
                      </span>
                      {phase.note ? <span className="block text-xs">{phase.note}</span> : null}
                    </span>
                  </li>
                ))}
              </ol>
            ) : null}
          </article>
        ))}
      </section>

      <section className="border-2 border-black rounded-lg p-4 space-y-3">
        <h2 className="font-semibold">{t('maintenance')}</h2>
        {bundle.maintenance.length === 0 ? <p className="text-sm text-gray-600">{t('noMaintenance')}</p> : null}
        {bundle.maintenance.map((plan) => (
          <article key={plan.id} className="border border-black rounded-lg p-3 text-sm">
            <h3 className="font-medium">{plan.name}</h3>
            <p className="text-xs text-gray-600">
              {t(`frequency.${plan.frequency}`)} · {t('with')} {plan.proName}
            </p>
            {plan.summary ? <p className="mt-1">{plan.summary}</p> : null}
            <p className="mt-1 text-xs">
              {t('nextVisit')}: {formatDay(plan.nextVisit)} · {t('lastVisit')}: {formatDay(plan.lastVisit)}
            </p>
            {plan.amountCents != null ? (
              <p className="text-xs">
                {t('eachVisit')}: {money(plan.amountCents)}
              </p>
            ) : null}
          </article>
        ))}
      </section>

      <section className="border-2 border-black rounded-lg p-4 space-y-2">
        <h2 className="font-semibold">{t('documents')}</h2>
        {bundle.documents.length === 0 ? <p className="text-sm text-gray-600">{t('noDocuments')}</p> : null}
        {bundle.documents.map((doc) => (
          <a
            key={doc.id}
            href={`/api/places/documents/${doc.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-3 border border-black rounded-lg px-3 py-2 text-sm hover:bg-gray-50"
          >
            <span>
              <span className="block font-medium">{doc.title}</span>
              <span className="text-xs text-gray-600">{t(`doc.${doc.kind}`)}</span>
            </span>
            <span className="text-red-600 font-medium">{t('openFile')}</span>
          </a>
        ))}
      </section>

      <section className="border-2 border-black rounded-lg p-4 space-y-2">
        <h2 className="font-semibold">{t('invoices')}</h2>
        {bundle.invoices.length === 0 ? <p className="text-sm text-gray-600">{t('noInvoices')}</p> : null}
        {bundle.invoices.map((invoice) => (
          <div key={invoice.id} className="flex items-center justify-between gap-3 border border-black rounded-lg px-3 py-2 text-sm">
            <span>
              <span className="block font-medium">{invoice.number}</span>
              <span className="text-xs text-gray-600">
                {invoice.status} · {t('balance')} {money(Math.max(0, invoice.amountCents - invoice.appliedCents))}
                {invoice.dueDate ? ` · ${formatDay(invoice.dueDate)}` : ''}
              </span>
            </span>
            <a href={`/api/crm/invoices/${invoice.id}/pdf`} className="text-red-600 font-medium" target="_blank" rel="noopener noreferrer">
              {t('openInvoice')}
            </a>
          </div>
        ))}
      </section>

      <section className="border-2 border-black rounded-lg p-4 space-y-2">
        <h2 className="font-semibold">{t('estimates')}</h2>
        {bundle.estimates.length === 0 ? <p className="text-sm text-gray-600">{t('noEstimates')}</p> : null}
        {bundle.estimates.map((estimate) => (
          <p key={estimate.id} className="text-sm border border-black rounded-lg px-3 py-2">
            {money(estimate.amountCents)} · {estimate.status}
            {estimate.dueDate ? ` · ${formatDay(estimate.dueDate)}` : ''}
          </p>
        ))}
      </section>
    </div>
  );
}
