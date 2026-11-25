'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { ArrowLeft, Camera, Car, CircleDollarSign, Mail, MapPin, Package, Pencil, Phone, Wrench } from 'lucide-react';
import { JobFinancials } from '@/components/crm/JobFinancials';
import { ProjectMaterials } from '@/components/projects/ProjectMaterials';
import { ProjectTrips } from '@/components/projects/ProjectTrips';
import { ProjectEquipment } from '@/components/projects/ProjectEquipment';
import { ProjectPhotos } from '@/components/projects/ProjectPhotos';
import { projectDurationText } from '@/lib/crm/project-duration';

interface ProjectInfo {
  id: string;
  displayId: string | null;
  name: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  note: string;
  customerId: string | null;
  customerDisplayName: string | null;
  customerCompany: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  place: { name: string | null; address: string } | null;
  estimate: { displayId: string | null; amountCents: number | null; status: string | null } | null;
}

const TABS = [
  { id: 'costs', label: 'Project costs', icon: CircleDollarSign },
  { id: 'materials', label: 'Materials', icon: Package },
  { id: 'trips', label: 'Trips', icon: Car },
  { id: 'equipment', label: 'Tools & equipment', icon: Wrench },
  { id: 'photos', label: 'Images', icon: Camera },
] as const;
type TabId = (typeof TABS)[number]['id'];

const STATUS_STYLE: Record<string, string> = {
  planned: 'border-gray-400 text-gray-800',
  in_progress: 'border-blue-600 text-blue-700',
  on_hold: 'border-amber-500 text-amber-700',
  completed: 'border-green-600 text-green-700',
  cancelled: 'border-red-500 text-red-700',
};

const money = (cents: number) => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(cents / 100);
const longDate = (iso: string | null) =>
  iso ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : null;

/** A project like a customer page: the project's info on top, then its costs, materials, trips, equipment and images. */
export default function ProjectPage() {
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ id: string }>();
  const id = params.id;
  const requested = searchParams.get('tab');
  const [tab, setTab] = useState<TabId>(TABS.some((item) => item.id === requested) ? (requested as TabId) : 'costs');
  const [info, setInfo] = useState<ProjectInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [counts, setCounts] = useState<Partial<Record<TabId, number>>>({});

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/crm/projects/${id}`, { credentials: 'include', cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) setError(data.error || 'Could not load the project');
        else setInfo(data);
      })
      .catch(() => !cancelled && setError('Could not load the project'));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const choose = (next: TabId) => {
    setTab(next);
    const query = new URLSearchParams(searchParams.toString());
    query.set('tab', next);
    router.replace(`?${query.toString()}`, { scroll: false });
  };
  const countFor = useCallback((key: TabId) => (count: number) => setCounts((current) => (current[key] === count ? current : { ...current, [key]: count })), []);
  const [onMaterials] = useState(() => countFor('materials'));
  const [onTrips] = useState(() => countFor('trips'));
  const [onEquipment] = useState(() => countFor('equipment'));

  const duration = info ? projectDurationText(info.startDate, info.endDate) : '';
  const dates = info ? [longDate(info.startDate), longDate(info.endDate)].filter(Boolean).join(' → ') : '';

  return (
    <div className="w-full space-y-4 px-2 py-2 md:px-6 md:py-4">
      <div className="no-print flex items-center justify-between gap-3">
        <Link href={`/${locale}/crm/projects`} className="flex items-center gap-2 font-medium text-gray-700 hover:text-black">
          <ArrowLeft className="h-5 w-5" /> Projects
        </Link>
        <Link
          href={`/${locale}/crm/projects?edit=${id}`}
          className="flex items-center gap-2 rounded-lg border-2 border-black px-3 py-1.5 text-sm font-medium hover:bg-gray-50"
        >
          <Pencil className="h-4 w-4" /> Edit project
        </Link>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <section className="no-print rounded-lg border-2 border-black bg-white p-4">
        {info ? (
          <div className="grid gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold">{info.name}</h1>
                {info.displayId ? <span className="rounded-md border-2 border-black px-2 py-0.5 text-xs font-medium">{info.displayId}</span> : null}
                <span className={`rounded-md border-2 px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLE[info.status] ?? 'border-gray-400'}`}>
                  {info.status.replace('_', ' ')}
                </span>
              </div>
              {info.customerId ? (
                <Link href={`/${locale}/crm/customers?open=${info.customerId}`} className="block text-lg font-medium hover:underline">
                  {info.customerDisplayName}
                  {info.customerCompany && info.customerCompany !== info.customerDisplayName ? (
                    <span className="text-sm font-normal text-gray-600"> · {info.customerCompany}</span>
                  ) : null}
                </Link>
              ) : null}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {info.customerPhone ? (
                  <a href={`tel:${info.customerPhone.replace(/[^\d+]/g, '')}`} className="flex items-center gap-1 hover:underline">
                    <Phone className="h-4 w-4 text-red-600" /> {info.customerPhone}
                  </a>
                ) : null}
                {info.customerEmail ? (
                  <a href={`mailto:${info.customerEmail}`} className="flex min-w-0 items-center gap-1 hover:underline">
                    <Mail className="h-4 w-4 shrink-0 text-red-600" /> <span className="truncate">{info.customerEmail}</span>
                  </a>
                ) : null}
              </div>
              {info.place?.address ? (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(info.place.address)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-1 text-sm hover:underline"
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  <span>
                    {info.place.name ? <span className="font-medium">{info.place.name} · </span> : null}
                    {info.place.address}
                  </span>
                </a>
              ) : null}
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-gray-500">Dates</dt>
                <dd className="font-medium">{dates || 'Not scheduled'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Duration</dt>
                <dd className="font-medium">{duration || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Contract</dt>
                <dd className="font-medium tabular-nums">{info.estimate?.amountCents != null ? money(info.estimate.amountCents) : '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Estimate</dt>
                <dd className="font-medium">{info.estimate?.displayId ? `#${info.estimate.displayId}` : '—'}</dd>
              </div>
              {info.note ? (
                <div className="col-span-2">
                  <dt className="text-xs text-gray-500">Notes</dt>
                  <dd className="whitespace-pre-line">{info.note}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        ) : !error ? (
          <p className="text-sm text-gray-500">Loading the project…</p>
        ) : null}
      </section>

      <div className="no-print overflow-x-auto pb-1" role="tablist" aria-label="Project">
        <div className="flex h-10 w-max items-center gap-2">
          {TABS.map((item) => {
            const selected = tab === item.id;
            const Icon = item.icon;
            const count = counts[item.id];
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => choose(item.id)}
                className={`flex h-10 shrink-0 items-center gap-1.5 rounded-lg border-2 px-3 text-sm font-medium transition-colors ${
                  selected ? 'border-black bg-black text-white' : 'border-transparent text-black hover:border-gray-400'
                }`}
              >
                <Icon className="h-[1.125rem] w-[1.125rem] text-red-500" aria-hidden />
                <span className="whitespace-nowrap">{item.label}</span>
                {count ? (
                  <span className={`rounded-md border px-1.5 text-xs tabular-nums ${selected ? 'border-white' : 'border-black'}`}>{count}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      <div role="tabpanel">
        {tab === 'costs' ? <JobFinancials kind="project" id={id} /> : null}
        {tab === 'materials' ? <ProjectMaterials projectId={id} onCount={onMaterials} /> : null}
        {tab === 'trips' ? <ProjectTrips projectId={id} onCount={onTrips} /> : null}
        {tab === 'equipment' ? <ProjectEquipment projectId={id} onCount={onEquipment} /> : null}
        {tab === 'photos' ? <ProjectPhotos projectId={id} embedded /> : null}
      </div>
    </div>
  );
}
