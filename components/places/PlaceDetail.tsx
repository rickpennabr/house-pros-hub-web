'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, FileCheck, FileText, FolderKanban, ImagePlus, MoreVertical, Receipt, Wrench } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { PlaceBundle } from '@/lib/places/portal';

const TABS = [
  { id: 'projects', icon: FolderKanban },
  { id: 'maintenance', icon: Wrench },
  { id: 'documents', icon: FileText },
  { id: 'invoices', icon: Receipt },
  { id: 'estimates', icon: FileCheck },
] as const;
type PlaceTab = (typeof TABS)[number]['id'];

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
  const tCommon = useTranslations('common.button');
  const locale = useLocale();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [bundle, setBundle] = useState<PlaceBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<PlaceTab>('projects');
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [stopId, setStopId] = useState<string | null>(null);
  const [stopping, setStopping] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/places/${placeId}`, { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setBundle(data as PlaceBundle);
      })
      .catch(() => setError(t('loadFailed')));
  }, [placeId, t]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      setMenuOpen(false);
      setConfirmDelete(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [menuOpen]);

  async function removePlace() {
    setDeleting(true);
    setPhotoError(null);
    try {
      const res = await fetch(`/api/places/${placeId}`, { method: 'DELETE', credentials: 'include' });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || t('deleteFailed'));
      router.push(`/${locale}/myplaces`);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : t('deleteFailed'));
      setDeleting(false);
    }
  }

  async function stopService(planId: string) {
    setStopping(true);
    setPhotoError(null);
    try {
      const res = await fetch(`/api/places/${placeId}/maintenance/${planId}/stop`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || t('stopFailed'));
      setBundle((current) =>
        current
          ? { ...current, maintenance: current.maintenance.filter((plan) => plan.id !== planId) }
          : current
      );
      setStopId(null);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : t('stopFailed'));
    } finally {
      setStopping(false);
    }
  }

  async function reload() {
    const res = await fetch(`/api/places/${placeId}`, { credentials: 'include' });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || t('loadFailed'));
    setBundle(data as PlaceBundle);
  }

  async function approveEstimate(estimateId: string) {
    setActingId(estimateId);
    setPhotoError(null);
    try {
      const res = await fetch(`/api/places/${placeId}/estimates/${estimateId}/approve`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; depositError?: string | null };
      if (!res.ok) throw new Error(data.error || t('approveFailed'));
      await reload();
      if (data.depositError) setPhotoError(data.depositError);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : t('approveFailed'));
    } finally {
      setActingId(null);
    }
  }

  async function payInvoice(invoiceId: string) {
    setActingId(invoiceId);
    setPhotoError(null);
    try {
      const res = await fetch(`/api/places/${placeId}/invoices/${invoiceId}/pay`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error || t('payFailed'));
      window.location.href = data.url;
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : t('payFailed'));
      setActingId(null);
    }
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setPhotoError(null);
    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch(`/api/places/${placeId}/photo`, {
        method: 'POST',
        credentials: 'include',
        body,
      });
      const data = (await res.json()) as { photoUrl?: string; error?: string };
      if (!res.ok || !data.photoUrl) throw new Error(data.error || t('photoFailed'));
      const photoUrl = data.photoUrl;
      setBundle((current) =>
        current ? { ...current, place: { ...current.place, photoUrl } } : current
      );
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : t('photoFailed'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  if (error) return <div className="p-4 md:p-6 text-red-600">{error}</div>;
  if (!bundle) return <div className="p-4 md:p-6 text-gray-500">{t('loading')}</div>;

  const streetLine = bundle.place.street?.trim() || '';
  const localityLine = [bundle.place.city, bundle.place.state, bundle.place.zipCode].filter(Boolean).join(', ');
  const photoUrl = bundle.place.photoUrl;

  return (
    <div className="px-2 py-4 md:p-4">
      <div className="space-y-2">
        <Link
          href={`/${locale}/myplaces`}
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-black"
        >
          <ArrowLeft className="h-5 w-5 shrink-0 text-red-500" />
          {t('back')}
        </Link>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            aria-label={photoUrl ? t('photoChange') : t('photoAdd')}
            className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border-2 border-black bg-gray-50 disabled:opacity-60 md:h-28 md:w-28"
          >
            {photoUrl ? (
              // Property photos live on the public storage host and change when the customer replaces them.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-gray-500">
                <ImagePlus className="h-5 w-5" />
              </span>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => void onPhoto(event.target.files?.[0])}
          />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="text-xs uppercase tracking-wide text-gray-500">{t(`kind.${bundle.place.kind}`)}</p>
            <h2 className="text-2xl font-semibold leading-tight">{bundle.place.name}</h2>
            {streetLine || localityLine ? (
              <p className="text-sm text-gray-700">
                {streetLine ? <span className="block">{streetLine}</span> : null}
                {localityLine ? <span className="block">{localityLine}</span> : null}
              </p>
            ) : null}
          </div>
          <div ref={menuRef} className="relative shrink-0 self-start">
            <button
              type="button"
              aria-label={t('delete')}
              aria-expanded={menuOpen}
              onClick={() => {
                setMenuOpen((open) => !open);
                setConfirmDelete(false);
              }}
              className="flex h-9 w-9 items-center justify-center rounded-lg border-2 border-transparent text-black hover:border-black"
            >
              <MoreVertical className="h-5 w-5" />
            </button>
            {menuOpen ? (
              <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-lg border-2 border-black bg-white p-2 shadow-lg">
                {confirmDelete ? (
                  <div className="space-y-2">
                    <p className="text-sm">{t('deleteConfirm')}</p>
                    <p className="text-xs text-gray-600">{t('deleteKeepsWork')}</p>
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={() => void removePlace()}
                      className="w-full rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
                    >
                      {deleting ? t('loading') : t('delete')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="w-full rounded-lg border-2 border-black px-3 py-1.5 text-sm font-medium"
                    >
                      {tCommon('cancel')}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="w-full rounded-lg px-2 py-1.5 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    {t('delete')}
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>
        {uploading ? <p className="text-sm text-gray-500">{t('loading')}</p> : null}
        {photoError ? <p className="text-sm text-red-600">{photoError}</p> : null}
      </div>

      <div className="mt-2 overflow-x-auto pb-4" role="tablist">
        <div className="flex h-10 w-max items-center gap-2 md:w-full">
          {TABS.map((item) => {
            const selected = tab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setTab(item.id)}
                className={`group flex h-10 shrink-0 items-center justify-center gap-1 rounded-lg border-2 px-2.5 text-sm font-medium transition-all duration-300 md:gap-2.5 md:px-4 ${
                  selected
                    ? 'border-black bg-black text-white'
                    : 'border-transparent bg-transparent text-black hover:border-gray-400'
                }`}
              >
                <Icon className="h-[1.125rem] w-[1.125rem] text-red-500" />
                <span className="whitespace-nowrap">{t(item.id)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {tab === 'projects' ? (
        <section className="border-2 border-black rounded-lg p-4 space-y-4" role="tabpanel">
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
      ) : null}

      {tab === 'maintenance' ? (
        <section className="border-2 border-black rounded-lg p-4 space-y-3" role="tabpanel">
          {bundle.maintenance.length === 0 ? <p className="text-sm text-gray-600">{t('noMaintenance')}</p> : null}
          {bundle.maintenance.map((plan) => (
            <article key={plan.id} className="border border-black rounded-lg p-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-medium">{plan.name}</h3>
                <button
                  type="button"
                  onClick={() => setStopId(stopId === plan.id ? null : plan.id)}
                  className="shrink-0 text-sm font-medium text-red-600"
                >
                  {t('stopService')}
                </button>
              </div>
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
              {stopId === plan.id ? (
                <div className="mt-3 space-y-2">
                  <p className="text-sm">{t('stopConfirm')}</p>
                  <button
                    type="button"
                    disabled={stopping}
                    onClick={() => void stopService(plan.id)}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {stopping ? t('loading') : t('stopService')}
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </section>
      ) : null}

      {tab === 'documents' ? (
        <section className="border-2 border-black rounded-lg p-4 space-y-2" role="tabpanel">
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
      ) : null}

      {tab === 'invoices' ? (
        <section className="border-2 border-black rounded-lg p-4 space-y-2" role="tabpanel">
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
              <span className="flex shrink-0 items-center gap-3">
                {invoice.status !== 'paid' && invoice.status !== 'cancelled' && invoice.amountCents - invoice.appliedCents > 0 ? (
                  <button
                    type="button"
                    disabled={actingId === invoice.id}
                    onClick={() => void payInvoice(invoice.id)}
                    className="text-sm font-medium text-black disabled:opacity-60"
                  >
                    {actingId === invoice.id ? t('loading') : t('pay')}
                  </button>
                ) : null}
                <a href={`/api/crm/invoices/${invoice.id}/pdf`} className="text-red-600 font-medium" target="_blank" rel="noopener noreferrer">
                  {t('openInvoice')}
                </a>
              </span>
            </div>
          ))}
        </section>
      ) : null}

      {tab === 'estimates' ? (
        <section className="border-2 border-black rounded-lg p-4 space-y-2" role="tabpanel">
          {bundle.estimates.length === 0 ? <p className="text-sm text-gray-600">{t('noEstimates')}</p> : null}
          {bundle.estimates.map((estimate) => (
            <div key={estimate.id} className="flex items-center justify-between gap-3 border border-black rounded-lg px-3 py-2 text-sm">
              <span>
                <span className="block font-medium">#{estimate.number}</span>
                <span className="text-xs text-gray-600">
                  {money(estimate.amountCents)} · {estimate.status}
                  {estimate.dueDate ? ` · ${formatDay(estimate.dueDate)}` : ''}
                  {estimate.status === 'sent' && estimate.depositCents > 0
                    ? ` · ${t('depositDue')} ${money(estimate.depositCents)}`
                    : ''}
                </span>
              </span>
              {estimate.status === 'sent' ? (
                <button
                  type="button"
                  disabled={actingId === estimate.id}
                  onClick={() => void approveEstimate(estimate.id)}
                  className="shrink-0 rounded-lg bg-black px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
                >
                  {actingId === estimate.id ? t('loading') : t('approve')}
                </button>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
