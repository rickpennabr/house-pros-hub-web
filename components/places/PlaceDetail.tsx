'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useActivityBadges } from '@/hooks/useActivityBadges';
import { NotificationCount } from '@/components/ui/NotificationCount';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  CalendarCheck,
  ClipboardList,
  FileCheck,
  FileText,
  FolderKanban,
  History,
  Building,
  Building2,
  Home,
  LayoutGrid,
  MoreVertical,
  Share2,
  Pencil,
  Receipt,
  Wrench,
  Mail,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { MobileGridActionsModal } from '@/components/crm/MobileGridActionsModal';
import { BookProPicker } from '@/components/booking/BookProPicker';
import { openQuickRepairCamera } from '@/lib/media/quick-repair-camera';
import { RepairCameraMark } from '@/components/pageslayout/PagesMenu';
import type { PlaceBundle } from '@/lib/places/portal';
import {
  CustomerEstimatePreview,
  type CustomerEstimatePreviewData,
} from '@/components/estimates/CustomerEstimatePreview';
import { MAINTENANCE_FREQUENCY_LABELS, type MaintenanceFrequency } from '@/lib/crm/estimate-agreement';
import { FileDropTarget } from '@/components/ui/FileDropTarget';
import { PlacePros } from '@/components/places/PlacePros';
import { TimelineSteps } from '@/components/timeline/TimelineSteps';
import { placeEventBy, placeEventEmailed, placeEventStepKind, type TimelineStep } from '@/lib/timeline/steps';

/** The header FIX camera (same animation), sized to the card tile. */
function FixCamAnimatedIcon({ className }: { className?: string }) {
  return (
    <span className={className}>
      <RepairCameraMark />
    </span>
  );
}

const TABS = [
  { id: 'timeline', icon: History },
  { id: 'projects', icon: FolderKanban },
  { id: 'maintenance', icon: Wrench },
  { id: 'appointments', icon: Calendar },
  { id: 'documents', icon: FileText },
  { id: 'invoices', icon: Receipt },
  { id: 'estimates', icon: FileCheck },
  { id: 'emails', icon: Mail },
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

function formatWhen(iso: string | null | undefined) {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return formatDay(iso.slice(0, 10));
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
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
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<PlaceTab | 'request'>(() => (searchParams.get('view') === 'request' ? 'request' : 'timeline'));
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [bookPickerOpen, setBookPickerOpen] = useState(false);
  const [tabMenuOpen, setTabMenuOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [stopId, setStopId] = useState<string | null>(null);
  const [stopping, setStopping] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);
  const [openEstimateId, setOpenEstimateId] = useState<string | null>(null);
  const [estimateDoc, setEstimateDoc] = useState<CustomerEstimatePreviewData | null>(null);
  const [estimateDocLoading, setEstimateDocLoading] = useState(false);
  const [estimateApproveMessage, setEstimateApproveMessage] = useState<string | null>(null);
  const [depositPaymentUrl, setDepositPaymentUrl] = useState<string | null>(null);
  const [proFilter, setProFilter] = useState<string | null>(null);
  const [sharePickerOpen, setSharePickerOpen] = useState(false);
  const tPros = useTranslations('places.prosSection');

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

  async function openEstimate(estimateId: string) {
    setOpenEstimateId(estimateId);
    setEstimateDoc(null);
    setEstimateApproveMessage(null);
    setDepositPaymentUrl(null);
    setEstimateDocLoading(true);
    setPhotoError(null);
    try {
      const res = await fetch(`/api/places/${placeId}/estimates/${estimateId}`, { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t('loadFailed'));
      setEstimateDoc(data as CustomerEstimatePreviewData);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : t('loadFailed'));
      setOpenEstimateId(null);
    } finally {
      setEstimateDocLoading(false);
    }
  }

  async function approveEstimate(estimateId: string, signerName: string) {
    setActingId(estimateId);
    setPhotoError(null);
    setEstimateApproveMessage(null);
    try {
      const res = await fetch(`/api/places/${placeId}/estimates/${estimateId}/approve`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signerName, signatureData: signerName }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        depositError?: string | null;
        depositPaymentUrl?: string | null;
        maintenanceError?: string | null;
        maintenancePlanId?: string | null;
      };
      if (!res.ok) throw new Error(data.error || t('approveFailed'));
      await reload();
      if (typeof data.depositPaymentUrl === 'string' && data.depositPaymentUrl) {
        setDepositPaymentUrl(data.depositPaymentUrl);
      }
      if (data.depositError) setPhotoError(data.depositError);
      if (data.maintenanceError) setEstimateApproveMessage(data.maintenanceError);
      else if (data.maintenancePlanId) setEstimateApproveMessage(t('maintenanceStarted'));
      else setEstimateApproveMessage(t('approvedThanks'));
      setEstimateDoc((current) =>
        current
          ? {
              ...current,
              status: 'accepted',
              signerName,
              signedAt: new Date().toISOString(),
            }
          : current
      );
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

  // Badges: what pros did since the homeowner last opened each tab (all pros on this place).
  const allSteps = useMemo<TimelineStep[]>(
    () =>
      (bundle?.timeline ?? []).map((event) => ({
        id: event.id,
        kind: placeEventStepKind(event.kind),
        at: event.occurredAt,
        title: event.title,
        by: placeEventBy(event.kind),
      })),
    [bundle?.timeline]
  );
  const { counts: unread, newIds } = useActivityBadges(bundle ? `place:${placeId}:` : null, allSteps, 'customer', tab);

  if (error) return <div className="p-4 md:p-6 text-red-600">{error}</div>;
  if (!bundle) return <div className="p-4 md:p-6 text-gray-500">{t('loading')}</div>;

  const startRename = () => {
    setNameDraft(bundle.place.name);
    setNameError(null);
    setEditingName(true);
    setMenuOpen(false);
  };

  const saveName = async () => {
    const next = nameDraft.trim() || bundle.place.street?.trim() || '';
    if (!next) {
      setNameError(t('nicknameRequired'));
      return;
    }
    if (next === bundle.place.name) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    setNameError(null);
    try {
      const response = await fetch(`/api/places/${bundle.place.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: next }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : t('nicknameFailed'));
      const saved = typeof data.name === 'string' ? data.name : next;
      setBundle((current) => (current ? { ...current, place: { ...current.place, name: saved } } : current));
      setEditingName(false);
    } catch (err) {
      setNameError(err instanceof Error ? err.message : t('nicknameFailed'));
    } finally {
      setSavingName(false);
    }
  };

  const streetLine = bundle.place.street?.trim() || '';
  const localityLine = [bundle.place.city, bundle.place.state, bundle.place.zipCode].filter(Boolean).join(', ');
  const photoUrl = bundle.place.photoUrl;

  // One pro is always picked (the first by default); the other pros sit beside it as the filter.
  // Rows that belong to no pro (the customer's own) show under every pro.
  const filterPro = (bundle.pros ?? []).find((pro) => pro.ownerId === proFilter) ?? bundle.pros?.[0] ?? null;
  const only = <T extends { ownerId: string | null }>(rows: T[]) =>
    filterPro ? rows.filter((row) => row.ownerId === null || row.ownerId === filterPro.ownerId) : rows;
  const view = {
    timeline: only(bundle.timeline),
    projects: only(bundle.projects),
    maintenance: only(bundle.maintenance),
    appointments: only(bundle.appointments),
    documents: only(bundle.documents),
    invoices: only(bundle.invoices),
    estimates: only(bundle.estimates),
  };

  return (
    <div className="px-2 py-2 md:p-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 md:py-1">
          <Link
            href={`/${locale}/myplaces`}
            aria-label={t('back')}
            className="inline-flex h-11 items-center gap-2 rounded-lg px-1 text-sm font-medium text-black hover:bg-gray-50"
          >
            <ArrowLeft className="h-5 w-5 shrink-0 text-red-500" />
            {t('title')}
          </Link>
          <button
            type="button"
            onClick={() => setTab('request')}
            aria-pressed={tab === 'request'}
            className="inline-flex h-[37px] items-center gap-2 rounded-lg bg-black px-3 text-sm font-medium text-white hover:bg-gray-800"
          >
            <ClipboardList className="h-5 w-5 shrink-0 text-red-500" />
            {t('serviceRequest')}
          </button>
        </div>

        <div className="flex items-center gap-3">
          <FileDropTarget inputRef={fileRef} className="shrink-0" rounded="rounded-xl">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            aria-label={photoUrl ? t('photoChange') : t('photoAdd')}
            className="relative h-[77px] w-[77px] shrink-0 overflow-hidden rounded-xl border-2 border-black bg-gray-50 disabled:opacity-60 md:h-28 md:w-28"
          >
            {photoUrl ? (
              // Property photos live on the public storage host and change when the customer replaces them.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-red-600">
                {bundle.place.kind === 'business' ? (
                  <Building2 className="h-8 w-8" />
                ) : bundle.place.kind === 'building' ? (
                  <Building className="h-8 w-8" />
                ) : (
                  <Home className="h-8 w-8" />
                )}
              </span>
            )}
          </button>
          </FileDropTarget>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => void onPhoto(event.target.files?.[0])}
          />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="hidden text-xs uppercase tracking-wide text-gray-500 md:block">{t(`kind.${bundle.place.kind}`)}</p>
            {editingName ? (
              <form
                className="mt-1 flex flex-wrap items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveName();
                }}
              >
                <input
                  autoFocus
                  value={nameDraft}
                  maxLength={120}
                  onChange={(event) => setNameDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') setEditingName(false);
                  }}
                  aria-label={t('nicknameLabel')}
                  placeholder={t('nicknamePlaceholder')}
                  disabled={savingName}
                  className="min-w-0 flex-1 rounded-lg border-2 border-black px-3 py-1.5 text-lg font-semibold"
                />
                <button
                  type="submit"
                  disabled={savingName}
                  className="rounded-lg bg-black px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
                >
                  {savingName ? t('loading') : t('nicknameSave')}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingName(false)}
                  className="rounded-lg border-2 border-black px-3 py-1.5 text-sm font-medium"
                >
                  {tCommon('cancel')}
                </button>
                {nameError ? <p className="w-full text-sm text-red-600">{nameError}</p> : null}
              </form>
            ) : (
              <h2 className="text-[18.4px] font-semibold leading-tight md:text-2xl">{bundle.place.name}</h2>
            )}
            {streetLine || localityLine ? (
              <p className="text-sm text-gray-700">
                {streetLine ? <span className="block">{streetLine}</span> : null}
                {localityLine ? <span className="block">{localityLine}</span> : null}
              </p>
            ) : null}
            <p className="mt-1 text-xs text-gray-500">
              {t('enteredOn')}: {formatWhen(bundle.place.createdAt)}
            </p>
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
              <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border-2 border-black bg-white p-2 shadow-lg">
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
                  <>
                  <button
                    type="button"
                    onClick={startRename}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-medium hover:bg-gray-100"
                  >
                    <Pencil className="h-4 w-4" />
                    {t('nicknameEdit')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="w-full rounded-lg px-2 py-1.5 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    {t('delete')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setSharePickerOpen(true);
                    }}
                    className="mt-1 flex w-full items-center gap-2 rounded-lg border-t border-gray-200 px-2 pt-2 pb-1.5 text-left text-sm font-medium hover:bg-gray-100"
                  >
                    <Share2 className="h-4 w-4 text-red-500" />
                    {tPros('share')}
                  </button>
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div>
        {uploading ? <p className="text-sm text-gray-500">{t('loading')}</p> : null}
        {photoError ? <p className="text-sm text-red-600">{photoError}</p> : null}
      </div>

      <PlacePros
        pros={bundle.pros ?? []}
        selected={filterPro?.ownerId ?? null}
        onSelect={setProFilter}
        onShare={() => setSharePickerOpen(true)}
      />
      <BookProPicker
        open={sharePickerOpen}
        onClose={() => setSharePickerOpen(false)}
        title={t('shareWithPro')}
        onPick={(pro) => {
          setSharePickerOpen(false);
          router.push(`/${locale}/probot?contact=${encodeURIComponent(pro.slug || pro.id)}&sharePlace=${bundle.place.id}`);
        }}
      />

      <div className="mt-2 flex items-start gap-2">
      <button
        type="button"
        onClick={() => setTabMenuOpen(true)}
        aria-label={t('tabsMenu')}
        className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border-2 border-black bg-black hover:bg-gray-800 md:hidden"
      >
        <LayoutGrid className="h-5 w-5 text-white" />
      </button>
      <MobileGridActionsModal
        isOpen={tabMenuOpen}
        onClose={() => setTabMenuOpen(false)}
        title={bundle.place.name}
        items={TABS.map((item) => ({
          id: item.id,
          label: (unread[item.id] ?? 0) > 0 ? `${t(item.id)} (${unread[item.id]})` : t(item.id),
          icon: item.icon,
          isActive: tab === item.id,
          onClick: () => setTab(item.id),
        }))}
      />
      <div className="min-w-0 flex-1 overflow-x-auto pb-2" role="tablist">
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
                <NotificationCount count={unread[item.id] ?? 0} />
              </button>
            );
          })}
        </div>
      </div>
      </div>

      {tab === 'timeline' ? (
        <section className="border-2 border-black rounded-lg p-4 space-y-3" role="tabpanel">
          <p className="text-sm text-gray-600">{t('timelineIntro')}</p>
          <TimelineSteps
            emptyText={t('noTimeline')}
            newIds={newIds}
            formatWhen={formatWhen}
            steps={view.timeline.map((event) => ({
              id: event.id,
              kind: placeEventStepKind(event.kind),
              at: event.occurredAt,
              title: event.title,
              detail:
                [event.proName ? `${t('with')} ${event.proName}` : null, event.detail, event.jobArea]
                  .filter(Boolean)
                  .join(' · ') || null,
              amountCents: typeof event.amountCents === 'number' ? event.amountCents : null,
            }))}
          />
        </section>
      ) : null}

      {tab === 'emails' ? (
        <section className="border-2 border-black rounded-lg p-4 space-y-3" role="tabpanel">
          <p className="text-sm text-gray-600">{t('emailsIntro')}</p>
          <TimelineSteps
            emptyText={t('noEmails')}
            formatWhen={formatWhen}
            steps={view.timeline
              .filter((event) => placeEventEmailed(event.kind))
              .map((event) => ({
                id: event.id,
                kind: placeEventStepKind(event.kind),
                at: event.occurredAt,
                title: event.title,
                detail:
                  [event.proName ? `${t('with')} ${event.proName}` : null, event.detail, event.jobArea]
                    .filter(Boolean)
                    .join(' · ') || null,
                amountCents: typeof event.amountCents === 'number' ? event.amountCents : null,
              }))}
          />
        </section>
      ) : null}

      {tab === 'projects' ? (
        <section className="border-2 border-black rounded-lg p-4 space-y-4" role="tabpanel">
          {view.projects.length === 0 ? <p className="text-sm text-gray-600">{t('noProjects')}</p> : null}
          {view.projects.map((project) => (
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
          {view.maintenance.length === 0 ? <p className="text-sm text-gray-600">{t('noMaintenance')}</p> : null}
          {view.maintenance.map((plan) => (
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

      {tab === 'request' ? (
        <section className="border-2 border-black rounded-lg p-4 space-y-4" aria-label={t('serviceRequest')}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {(
              [
                { id: 'fixcam', Icon: FixCamAnimatedIcon, onClick: () => openQuickRepairCamera() },
                { id: 'estimate', Icon: FileCheck, href: `/${locale}/estimate` },
                { id: 'probooking', Icon: CalendarCheck, onClick: () => setBookPickerOpen(true) },
              ] as const
            ).map((option) => {
              const body = (
                <>
                  <span className="flex aspect-square w-full items-center justify-center rounded-lg border-2 border-black bg-white text-black md:h-20 md:w-20 md:shrink-0">
                    <option.Icon
                      className={option.id === 'fixcam' ? 'block h-14 w-[72px] md:h-12 md:w-16' : 'h-9 w-9 text-red-500 md:h-8 md:w-8'}
                    />
                  </span>
                  <span className="min-w-0 text-center md:text-left">
                    <span className="block font-semibold leading-tight">{t(`request.${option.id}.title`)}</span>
                    <span className="mt-1 line-clamp-2 text-xs text-gray-600">{t(`request.${option.id}.how`)}</span>
                  </span>
                </>
              );
              const className =
                'flex flex-col items-stretch gap-2 rounded-xl border-2 border-black p-2 text-left hover:bg-gray-50 md:flex-row md:items-center md:gap-3 md:p-3';
              return 'href' in option ? (
                <Link key={option.id} href={option.href} className={className}>
                  {body}
                </Link>
              ) : (
                <button key={option.id} type="button" onClick={option.onClick} className={className}>
                  {body}
                </button>
              );
            })}
          </div>
          <BookProPicker open={bookPickerOpen} onClose={() => setBookPickerOpen(false)} />
        </section>
      ) : null}

      {tab === 'appointments' ? (
        <section className="border-2 border-black rounded-lg p-4 space-y-2" role="tabpanel">
          {view.appointments.length === 0 ? <p className="text-sm text-gray-600">{t('noAppointments')}</p> : null}
          {view.appointments.map((visit) => {
            const when = new Date(visit.startAt).toLocaleString(locale, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              timeZone: visit.timezone,
            });
            const title =
              visit.serviceName?.trim() ||
              (visit.taskType ? t(`taskType.${visit.taskType}`) : t('appointmentVisit'));
            const meta = (
              <span>
                <span className="block font-medium">{title}</span>
                <span className="text-xs text-gray-600">
                  {t('with')} {visit.proName} · {t(`appointmentStatus.${visit.status}`)} · {when}
                  {visit.source === 'task' ? ` · ${t('scheduledByPro')}` : ''}
                </span>
              </span>
            );
            if (visit.token) {
              return (
                <Link
                  key={visit.id}
                  href={`/${locale}/appointments/${visit.token}`}
                  className="flex items-center justify-between gap-3 border border-black rounded-lg px-3 py-2 text-sm hover:bg-gray-50"
                >
                  {meta}
                  <span className="text-red-600 font-medium">
                    {visit.canChange ? t('manageAppointment') : t('openAppointment')}
                  </span>
                </Link>
              );
            }
            return (
              <div
                key={visit.id}
                className="flex items-center justify-between gap-3 border border-black rounded-lg px-3 py-2 text-sm"
              >
                {meta}
              </div>
            );
          })}
        </section>
      ) : null}

      {tab === 'documents' ? (
        <section className="border-2 border-black rounded-lg p-4 space-y-2" role="tabpanel">
          {view.documents.length === 0 ? <p className="text-sm text-gray-600">{t('noDocuments')}</p> : null}
          {view.documents.map((doc) => (
            <a
              key={doc.id}
              href={`/api/places/documents/${doc.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 border border-black rounded-lg px-3 py-2 text-sm hover:bg-gray-50"
            >
              <span>
                <span className="block font-medium">{doc.title}</span>
                <span className="text-xs text-gray-600">
                  {t(`doc.${doc.kind}`)} · {t('with')} {doc.proName} · {t('receivedOn')} {formatWhen(doc.receivedAt)}
                </span>
              </span>
              <span className="text-red-600 font-medium">{t('openFile')}</span>
            </a>
          ))}
        </section>
      ) : null}

      {tab === 'invoices' ? (
        <section className="border-2 border-black rounded-lg p-4 space-y-2" role="tabpanel">
          {view.invoices.length === 0 ? <p className="text-sm text-gray-600">{t('noInvoices')}</p> : null}
          {view.invoices.map((invoice) => (
            <div key={invoice.id} className="flex items-center justify-between gap-3 border border-black rounded-lg px-3 py-2 text-sm">
              <span>
                <span className="block font-medium">{invoice.number}</span>
                <span className="text-xs text-gray-600">
                  {t('with')} {invoice.proName} · {invoice.status} · {t('balance')}{' '}
                  {money(Math.max(0, invoice.amountCents - invoice.appliedCents))}
                  {invoice.dueDate ? ` · ${formatDay(invoice.dueDate)}` : ''}
                  {` · ${t('receivedOn')} ${formatWhen(invoice.receivedAt)}`}
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
          {view.estimates.length === 0 ? <p className="text-sm text-gray-600">{t('noEstimates')}</p> : null}
          {view.estimates.map((estimate) => {
            const schedule =
              estimate.maintenanceFrequency &&
              (MAINTENANCE_FREQUENCY_LABELS[estimate.maintenanceFrequency as MaintenanceFrequency] ||
                estimate.maintenanceFrequency);
            return (
              <div key={estimate.id} className="border border-black rounded-lg px-3 py-2 text-sm space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span>
                    <span className="block font-medium">
                      #{estimate.number}
                      {estimate.jobArea ? ` · ${estimate.jobArea}` : ''}
                      {estimate.agreementKind === 'maintenance' ? ` · ${t('maintenanceAgreement')}` : ''}
                    </span>
                    <span className="text-xs text-gray-600">
                      {t('with')} {estimate.proName} · {money(estimate.amountCents)} · {estimate.status}
                      {schedule ? ` · ${schedule}` : ''}
                      {estimate.dueDate ? ` · ${formatDay(estimate.dueDate)}` : ''}
                      {estimate.status === 'sent' && estimate.depositCents > 0
                        ? ` · ${t('depositDue')} ${money(estimate.depositCents)}`
                        : ''}
                      {` · ${t('receivedOn')} ${formatWhen(estimate.receivedAt)}`}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => void openEstimate(estimate.id)}
                    className={`shrink-0 rounded-lg border-2 px-3 py-1.5 text-sm font-medium ${
                      estimate.status === 'accepted' ? 'border-green-700 bg-green-50 text-green-800' : 'border-black'
                    }`}
                  >
                    {/* Already signed: say so; the button still opens it to read. */}
                    {estimate.status === 'accepted' ? `✓ ${t('signedApproved')}` : t('openAgreement')}
                  </button>
                </div>
                {openEstimateId === estimate.id ? (
                  <div className="border-t border-black pt-3 space-y-3">
                    {estimateDocLoading ? <p className="text-sm text-gray-500">{t('loading')}</p> : null}
                    {estimateDoc ? (
                      <CustomerEstimatePreview
                        data={estimateDoc}
                        variant="portal"
                        onApprove={({ signerName }) => void approveEstimate(estimate.id, signerName)}
                        approveLoading={actingId === estimate.id}
                        alreadyAccepted={estimateDoc.status === 'accepted'}
                        approveMessage={estimateApproveMessage}
                      />
                    ) : null}
                    {depositPaymentUrl ? (
                      <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-amber-950">{t('payAfterSign')}</p>
                        <a
                          href={depositPaymentUrl}
                          className="inline-flex items-center justify-center rounded-lg bg-black px-3 py-2 text-sm font-semibold text-white"
                        >
                          {t('payNow')}
                        </a>
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        setOpenEstimateId(null);
                        setEstimateDoc(null);
                        setDepositPaymentUrl(null);
                        setEstimateApproveMessage(null);
                      }}
                      className="text-sm font-medium text-gray-700"
                    >
                      {tCommon('close')}
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </section>
      ) : null}
    </div>
  );
}
