'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  Home,
  KeyRound,
  Leaf,
  Mail,
  MapPin,
  Phone,
  User,
  Users,
} from 'lucide-react';
import { isMaintenanceFrequency, MAINTENANCE_FREQUENCY_LABELS } from '@/lib/crm/estimate-agreement';
import { formatDurationClock } from '@/lib/crm/maintenance-defaults';
import { formatLaborHours } from '@/lib/crm/maintenance-time';
import type { VisitReport, VisitReportMedia } from '@/lib/crm/maintenance-visit-report';

const STATUS_LABEL: Record<VisitReport['visit']['status'], string> = {
  in_progress: 'In progress',
  on_break: 'On break',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

function formatTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof Home; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-lg border-2 border-black bg-white p-4">
      <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
        <Icon className="h-4 w-4" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900 break-words">{value}</dd>
    </div>
  );
}

function MediaGrid({ items }: { items: VisitReportMedia[] }) {
  if (items.length === 0) return <p className="text-sm text-gray-500">None recorded.</p>;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {items.map((item) => (
        <figure key={item.id} className="overflow-hidden rounded-lg border border-black/20 bg-gray-50">
          {!item.url ? (
            <div className="flex aspect-square items-center justify-center text-xs text-gray-500">Unavailable</div>
          ) : item.kind === 'video' ? (
            <video src={item.url} controls preload="metadata" className="aspect-square w-full bg-black object-contain" />
          ) : (
            <a href={item.url} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL */}
              <img src={item.url} alt={item.caption || 'Visit photo'} className="aspect-square w-full object-cover" />
            </a>
          )}
          {item.caption ? <figcaption className="px-2 py-1 text-xs text-gray-700">{item.caption}</figcaption> : null}
        </figure>
      ))}
    </div>
  );
}

export default function MaintenanceVisitReportPage() {
  const locale = useLocale();
  const params = useParams();
  const id = params.id as string;
  const [report, setReport] = useState<VisitReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/crm/maintenance/visits/${id}/report`, { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Could not load the report');
        if (!cancelled) setReport(data.report);
      })
      .catch((err: unknown) => !cancelled && setError(err instanceof Error ? err.message : 'Could not load the report'));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const backHref = report?.property.houseId
    ? `/${locale}/crm/maintenance/houses/${report.property.houseId}`
    : `/${locale}/crm/maintenance?tab=visits`;

  if (error) {
    return (
      <div className="w-full md:max-w-3xl md:mx-auto space-y-4 py-4">
        <Link href={`/${locale}/crm/maintenance?tab=visits`} className="flex items-center gap-2 font-medium text-gray-700 hover:text-black">
          <ArrowLeft className="h-5 w-5" /> Visits
        </Link>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
      </div>
    );
  }
  if (!report) return <div className="p-12 text-center text-sm text-gray-500">Loading visit report…</div>;

  const { visit, property } = report;
  const before = report.media.filter((item) => item.phase === 'before');
  const after = report.media.filter((item) => item.phase === 'after');
  const mapsUrl = property.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(property.address)}`
    : null;

  return (
    <div className="w-full md:max-w-3xl md:mx-auto space-y-4 pb-24">
      <div className="flex items-center justify-between gap-4 py-2">
        <Link href={backHref} className="flex items-center gap-2 font-medium text-gray-700 hover:text-black">
          <ArrowLeft className="h-5 w-5 shrink-0" /> {property.houseId ? 'House' : 'Visits'}
        </Link>
        {visit.status === 'completed' ? (
          <a
            href={`/api/crm/maintenance/visits/${visit.id}/pdf`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border-2 border-black bg-black px-3 text-sm font-medium text-white hover:bg-gray-800"
          >
            <Download className="h-4 w-4" /> PDF report
          </a>
        ) : null}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-gray-900">Visit report</h1>
          <p className="text-sm text-gray-600">
            {property.customerName} · {formatTime(visit.startedAt)}
          </p>
        </div>
        <span className="inline-flex items-center rounded-md border border-black px-2 py-0.5 text-xs font-medium">
          {STATUS_LABEL[visit.status] ?? visit.status}
        </span>
      </div>

      <Section title="Property" icon={Home}>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Fact label="Contact" value={property.customerName} />
          <Fact label="House" value={[property.placeName, property.address].filter(Boolean).join(' · ') || 'No address on file'} />
          {property.agreementName ? (
            <Fact
              label="Agreement"
              value={`${property.agreementName}${
                property.frequency && isMaintenanceFrequency(property.frequency)
                  ? ` · ${MAINTENANCE_FREQUENCY_LABELS[property.frequency]}`
                  : ''
              }`}
            />
          ) : null}
          {property.nextVisitDate ? <Fact label="Next visit" value={property.nextVisitDate} /> : null}
          {report.project ? <Fact label="Project" value={report.project.name} /> : null}
        </dl>
        <div className="flex flex-wrap gap-2">
          {property.phone ? (
            <a href={`tel:${property.phone}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border-2 border-black px-3 text-sm hover:bg-gray-50">
              <Phone className="h-4 w-4" /> Call
            </a>
          ) : null}
          {property.email ? (
            <a href={`mailto:${property.email}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border-2 border-black px-3 text-sm hover:bg-gray-50">
              <Mail className="h-4 w-4" /> Email
            </a>
          ) : null}
          {mapsUrl ? (
            <a href={mapsUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg border-2 border-black px-3 text-sm hover:bg-gray-50">
              <MapPin className="h-4 w-4" /> Map
            </a>
          ) : null}
        </div>
        {property.accessNotes ? (
          <div className="flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            <KeyRound className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="whitespace-pre-wrap">{property.accessNotes}</p>
          </div>
        ) : null}
      </Section>

      <Section title="Crew" icon={Users}>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Fact
            label="Maintenance responsible"
            value={
              <span className="inline-flex items-center gap-1">
                <User className="h-4 w-4" /> {report.responsible ?? 'Not set'}
              </span>
            }
          />
          <Fact label="Workers" value={String(visit.workerCount)} />
          {report.crew.length > 0 ? <Fact label="On this visit" value={report.crew.join(', ')} /> : null}
        </dl>
      </Section>

      <Section title="Time" icon={Clock}>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Fact label="Started" value={formatTime(visit.startedAt)} />
          <Fact label="Ended" value={visit.endedAt ? formatTime(visit.endedAt) : STATUS_LABEL[visit.status]} />
          <Fact label="On site" value={visit.activeSeconds != null ? formatDurationClock(visit.activeSeconds) : '—'} />
          <Fact label="Breaks" value={formatDurationClock(visit.breakSeconds)} />
          <Fact label="Labor" value={visit.laborSeconds != null ? formatLaborHours(visit.laborSeconds) : '—'} />
        </dl>
      </Section>

      <Section title="Services performed" icon={CheckCircle2}>
        {report.services.length === 0 ? (
          <p className="text-sm text-gray-500">No services recorded.</p>
        ) : (
          <ul className="space-y-2">
            {report.services.map((service, index) => (
              <li key={`${service.name}-${index}`} className="text-sm">
                <div className="flex items-center gap-2 font-medium">
                  <CheckCircle2 className="h-4 w-4 text-green-600" /> {service.name}
                </div>
                {service.description ? <p className="ml-6 text-gray-600">{service.description}</p> : null}
              </li>
            ))}
          </ul>
        )}
        {visit.workSummary ? (
          <div className="border-t border-black/15 pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Work summary</p>
            <p className="whitespace-pre-wrap text-sm">{visit.workSummary}</p>
          </div>
        ) : null}
        {visit.notes ? (
          <div className="border-t border-black/15 pt-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Crew notes</p>
            <p className="whitespace-pre-wrap text-sm">{visit.notes}</p>
          </div>
        ) : null}
        {property.scopeOfWork ? (
          <details className="border-t border-black/15 pt-3 text-sm">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-gray-500">
              The job (from the agreement)
            </summary>
            <p className="mt-1 whitespace-pre-wrap text-gray-700">{property.scopeOfWork}</p>
          </details>
        ) : null}
      </Section>

      <Section title={`Before (${before.length})`} icon={Home}>
        <MediaGrid items={before} />
      </Section>
      <Section title={`After (${after.length})`} icon={CheckCircle2}>
        <MediaGrid items={after} />
      </Section>

      {report.plants.length > 0 ? (
        <Section title="Plants at this house" icon={Leaf}>
          <ul className="divide-y divide-black/10 text-sm">
            {report.plants.map((plant, index) => (
              <li key={`${plant.name}-${index}`} className="flex items-start justify-between gap-2 py-2">
                <div className="min-w-0">
                  <div className="font-medium">
                    {plant.name}
                    {plant.quantity > 1 ? ` × ${plant.quantity}` : ''}
                  </div>
                  {plant.area || plant.notes ? (
                    <div className="text-xs text-gray-600">{[plant.area, plant.notes].filter(Boolean).join(' · ')}</div>
                  ) : null}
                </div>
                {plant.photoCount > 0 ? (
                  <span className="shrink-0 text-xs text-gray-500">
                    {plant.photoCount} photo{plant.photoCount === 1 ? '' : 's'}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </div>
  );
}
