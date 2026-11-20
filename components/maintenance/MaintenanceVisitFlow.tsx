'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Camera,
  Car,
  Check,
  Coffee,
  Download,
  Flag,
  Minus,
  Play,
  Trash2,
  Plus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { JobCameraSession } from '@/components/media/JobCameraSession';
import { scopeItems } from '@/components/maintenance/HouseAgreementForm';
import { MaintenancePlantsPanel } from '@/components/maintenance/MaintenancePlantsPanel';
import { uploadProDriveFile } from '@/lib/drive/upload-client';
import { formatDurationClock } from '@/lib/crm/maintenance-defaults';
import { computeActiveSeconds, formatLaborHours } from '@/lib/crm/maintenance-time';
import { primeLiveCamera } from '@/lib/media/prime-camera';
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal';

type Step = 'setup' | 'active' | 'done';

interface CustomerOption {
  id: string;
  name: string;
}

interface PlanOption {
  id: string;
  name: string;
  customerId: string;
}

interface CrewOption {
  id: string;
  displayName: string;
  status: string;
  email: string;
}

interface ServiceOption {
  id: string;
  name: string;
  descriptionTemplate: string;
}

interface VisitState {
  id: string;
  customerId: string;
  maintenancePlanId: string | null;
  status: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  breakSeconds: number;
  pauseStartedAt: string | null;
  workerCount: number;
  laborSeconds: number | null;
  notes: string | null;
  generatedDescription: string | null;
  customerName: string;
}

interface DayState {
  id: string;
  workDate: string;
  status: 'open' | 'closed';
  startedAt: string;
  endedAt: string | null;
  totalVisitSeconds: number;
  totalBreakSeconds: number;
  totalTripSeconds: number;
  totalLaborSeconds: number;
  visitCount: number;
  tripCount: number;
  maxWorkers: number;
}

interface TripState {
  id: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  isOpen: boolean;
}

interface MaintenanceVisitFlowProps {
  autoStart?: boolean;
  onCloseAutoStart?: () => void;
  /** Shown at the left of the header row (the page puts its tabs here). */
  headerStart?: ReactNode;
  /** Preselect this house when the start form opens. */
  initialCustomerId?: string;
  /** Preselect this maintenance agreement (house) when the start form opens. */
  initialPlanId?: string;
}

type ApiVisit = Partial<VisitState> & { id: string; status: string; startedAt: string };

function toVisitState(raw: ApiVisit, fallbackName = 'Customer'): VisitState {
  return {
    id: raw.id,
    customerId: raw.customerId ?? '',
    maintenancePlanId: raw.maintenancePlanId ?? null,
    status: raw.status,
    startedAt: raw.startedAt,
    endedAt: raw.endedAt ?? null,
    durationSeconds: raw.durationSeconds ?? null,
    breakSeconds: raw.breakSeconds ?? 0,
    pauseStartedAt: raw.pauseStartedAt ?? null,
    workerCount: raw.workerCount ?? 1,
    laborSeconds: raw.laborSeconds ?? null,
    notes: raw.notes ?? null,
    generatedDescription: raw.generatedDescription ?? null,
    customerName: raw.customerName ?? fallbackName,
  };
}

function isOpenVisit(status: string) {
  return status === 'in_progress' || status === 'on_break';
}

function secondsSince(iso: string, now: number) {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-black/15 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className="font-mono text-base font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function WorkerStepper({
  value,
  min = 1,
  onChange,
  disabled,
  label,
}: {
  value: number;
  min?: number;
  onChange: (next: number) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={`${label} -1`}
        disabled={disabled || value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-black disabled:opacity-40"
      >
        <Minus className="h-4 w-4" />
      </button>
      <span className="w-8 text-center font-mono text-lg font-semibold tabular-nums">{value}</span>
      <button
        type="button"
        aria-label={`${label} +1`}
        disabled={disabled || value >= 50}
        onClick={() => onChange(Math.min(50, value + 1))}
        className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-black disabled:opacity-40"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

export function MaintenanceVisitFlow({
  autoStart = false,
  onCloseAutoStart,
  headerStart,
  initialCustomerId = '',
  initialPlanId = '',
}: MaintenanceVisitFlowProps) {
  const t = useTranslations('maintenance');
  const locale = useLocale();

  const [step, setStep] = useState<Step>('setup');
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [crew, setCrew] = useState<CrewOption[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(initialCustomerId);
  const [selectedPlanId, setSelectedPlanId] = useState(initialPlanId);
  const [responsibleCrewId, setResponsibleCrewId] = useState('');
  const [workerCrewIds, setWorkerCrewIds] = useState<string[]>([]);
  const [extraWorkers, setExtraWorkers] = useState(0);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [visit, setVisit] = useState<VisitState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [mediaPhase, setMediaPhase] = useState<'before' | 'after' | null>(null);
  const [beforeCount, setBeforeCount] = useState(0);
  const [afterCount, setAfterCount] = useState(0);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Visit waiting for the delete confirmation. */
  const [deletingVisitId, setDeletingVisitId] = useState<string | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [newServiceName, setNewServiceName] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [visits, setVisits] = useState<VisitState[]>([]);
  const [showWizard, setShowWizard] = useState(Boolean(autoStart));
  const [day, setDay] = useState<DayState | null>(null);
  const [trips, setTrips] = useState<TripState[]>([]);
  const [closedDay, setClosedDay] = useState<DayState | null>(null);
  const [confirmEndDay, setConfirmEndDay] = useState(false);

  const customerPlans = useMemo(
    () => plans.filter((plan) => plan.customerId === selectedCustomerId),
    [plans, selectedCustomerId]
  );

  // Every listed customer has an agreement, so default to it instead of "no plan".
  useEffect(() => {
    if (customerPlans.length === 0) return;
    if (!customerPlans.some((plan) => plan.id === selectedPlanId)) {
      setSelectedPlanId(customerPlans[0].id);
    }
  }, [customerPlans, selectedPlanId]);

  const openTrip = trips.find((trip) => trip.isOpen) ?? null;
  const visitRunning = !!visit && isOpenVisit(visit.status);
  const setupWorkerCount = Math.min(
    50,
    Math.max(1, new Set([...workerCrewIds, ...(responsibleCrewId ? [responsibleCrewId] : [])]).size) + extraWorkers
  );

  // One clock drives every live timer (visit, break, trip).
  useEffect(() => {
    if (!visitRunning && !openTrip) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [visitRunning, openTrip]);

  const activeSeconds = visit
    ? visitRunning
      ? computeActiveSeconds({
          startedAt: visit.startedAt,
          breakSeconds: visit.breakSeconds,
          pauseStartedAt: visit.pauseStartedAt,
          now: new Date(now),
        })
      : visit.durationSeconds ?? 0
    : 0;
  const currentBreakSeconds =
    visit?.status === 'on_break' && visit.pauseStartedAt ? secondsSince(visit.pauseStartedAt, now) : 0;
  const liveLaborSeconds = activeSeconds * (visit?.workerCount ?? 1);

  const loadDay = useCallback(async () => {
    try {
      const response = await fetch('/api/crm/maintenance/days', { credentials: 'include' });
      if (!response.ok) return;
      const body = await response.json();
      setDay(body.day ?? null);
      setTrips(body.trips ?? []);
    } catch {
      // Day summary is supplementary; the visit flow still works without it.
    }
  }, []);

  const loadMediaMeta = useCallback(async (visitId: string) => {
    const response = await fetch(`/api/crm/maintenance/visits/${visitId}/media`, { credentials: 'include' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return;
    setBusinessId(body.businessId ?? null);
    const media = body.media ?? [];
    setBeforeCount(media.filter((item: { phase: string }) => item.phase === 'before').length);
    setAfterCount(media.filter((item: { phase: string }) => item.phase === 'after').length);
  }, []);

  /** Bring back a visit that was still running when the app closed. */
  const resumeOpenVisit = useCallback(
    async (visitId: string) => {
      const response = await fetch(`/api/crm/maintenance/visits/${visitId}`, { credentials: 'include' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.visit) return;
      setVisit(toVisitState(body.visit));
      setNotes(body.visit.notes ?? '');
      setSelectedServiceIds(
        ((body.services ?? []) as { serviceOptionId: string | null }[])
          .map((row) => row.serviceOptionId)
          .filter((id): id is string => !!id)
      );
      setStep('active');
      setShowWizard(true);
      void loadMediaMeta(visitId);
    },
    [loadMediaMeta]
  );

  const loadLists = useCallback(
    async (opts?: { restore?: boolean }) => {
      try {
        const [customersRes, plansRes, crewRes, servicesRes, visitsRes] = await Promise.all([
          fetch('/api/crm/maintenance/houses?pageSize=100&sortBy=name&sortDir=asc', { credentials: 'include' }),
          fetch('/api/crm/portal', { credentials: 'include' }),
          fetch('/api/crm/maintenance/crew', { credentials: 'include' }),
          fetch('/api/crm/maintenance/services', { credentials: 'include' }),
          fetch('/api/crm/maintenance/visits', { credentials: 'include' }),
        ]);

        const customersBody = await customersRes.json();
        const plansBody = await plansRes.json().catch(() => ({}));
        const crewBody = await crewRes.json();
        const servicesBody = await servicesRes.json();
        const visitsBody = await visitsRes.json();
        setError(null);

        // Only contacts that already have a maintenance agreement (a house that has not ended).
        const agreementCustomers = new Map<string, CustomerOption>();
        for (const house of (customersBody.houses ?? []) as Array<{
          customerId: string;
          customerName: string;
          status: string;
        }>) {
          if (house.status === 'ended' || agreementCustomers.has(house.customerId)) continue;
          agreementCustomers.set(house.customerId, { id: house.customerId, name: house.customerName });
        }
        setCustomers([...agreementCustomers.values()]);

        const portalPlans = (plansBody.maintenancePlans ?? plansBody.plans ?? []) as Array<{
          id: string;
          name: string;
          customer_id?: string;
          customerId?: string;
          is_active?: boolean;
        }>;
        setPlans(
          portalPlans
            .filter((plan) => plan.is_active !== false)
            .map((plan) => ({
              id: plan.id,
              name: plan.name,
              customerId: plan.customer_id ?? plan.customerId ?? '',
            }))
            .filter((plan) => plan.customerId)
        );

        setCrew(crewBody.crew ?? []);
        setServices(servicesBody.services ?? []);
        const list = ((visitsBody.visits ?? []) as ApiVisit[]).map((row) => toVisitState(row));
        setVisits(list);

        if (opts?.restore) {
          const open = list.find((row) => isOpenVisit(row.status));
          if (open) await resumeOpenVisit(open.id);
        }
      } catch {
        setError(t('loadFailed'));
      }
    },
    [resumeOpenVisit, t]
  );

  const confirmDeleteVisit = async () => {
    if (!deletingVisitId) return;
    setDeletingBusy(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/crm/maintenance/visits/${deletingVisitId}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : t('deleteVisitFailed'));
      const removedId = deletingVisitId;
      setVisits((current) => current.filter((row) => row.id !== removedId));
      setDeletingVisitId(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : t('deleteVisitFailed'));
    } finally {
      setDeletingBusy(false);
    }
  };

  useEffect(() => {
    void loadLists({ restore: true });
    void loadDay();
  }, [loadLists, loadDay]);

  /** Select the jobs listed on the house's agreement, so the crew only adds extras. */
  async function preselectHouseJobs(planId: string) {
    const response = await fetch(`/api/crm/maintenance/houses/${planId}`, { credentials: 'include' }).catch(() => null);
    if (!response?.ok) return;
    const body = await response.json().catch(() => ({}));
    const jobs = scopeItems(body.house?.scopeOfWork ?? '').map((job) => job.toLowerCase());
    if (jobs.length === 0) return;
    const ids = services.filter((service) => jobs.includes(service.name.toLowerCase())).map((service) => service.id);
    if (ids.length > 0) setSelectedServiceIds((prev) => [...new Set([...prev, ...ids])]);
  }

  async function startVisit() {
    if (!selectedCustomerId) {
      setError(t('pickCustomer'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const crewMemberIds = [...new Set([...workerCrewIds, ...(responsibleCrewId ? [responsibleCrewId] : [])])];
      const response = await fetch('/api/crm/maintenance/visits', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomerId,
          maintenancePlanId: selectedPlanId || null,
          responsibleCrewId: responsibleCrewId || null,
          crewMemberIds,
          // Server counts max(crew, 1) + extras, matching setupWorkerCount.
          extraWorkers,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || t('startFailed'));
      setVisit(
        toVisitState(body.visit, customers.find((c) => c.id === selectedCustomerId)?.name ?? 'Customer')
      );
      setNow(Date.now());
      setStep('active');
      if (selectedPlanId) void preselectHouseJobs(selectedPlanId);
      setBeforeCount(0);
      setAfterCount(0);
      setClosedDay(null);
      void loadMediaMeta(body.visit.id);
      void loadDay();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('startFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function toggleBreak() {
    if (!visit) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/crm/maintenance/visits/${visit.id}/timer`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: visit.status === 'on_break' ? 'resume' : 'break' }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || t('breakFailed'));
      setVisit((current) => (current ? toVisitState(body.visit, current.customerName) : current));
      setNow(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : t('breakFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function updateWorkerCount(next: number) {
    if (!visit) return;
    const previous = visit.workerCount;
    setVisit({ ...visit, workerCount: next });
    try {
      const response = await fetch(`/api/crm/maintenance/visits/${visit.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workerCount: next }),
      });
      if (!response.ok) throw new Error();
    } catch {
      setVisit((current) => (current ? { ...current, workerCount: previous } : current));
      setError(t('workersFailed'));
    }
  }

  async function saveCameraItems(items: { file: File; caption: string }[]) {
    if (!visit || !mediaPhase) return;
    if (!businessId) throw new Error(t('noBusiness'));
    for (const item of items) {
      const orientation =
        typeof window !== 'undefined' && window.innerHeight >= window.innerWidth ? 'portrait' : 'landscape';
      const saved = await uploadProDriveFile({
        file: item.file,
        ownerType: 'business',
        ownerId: businessId,
        ensureFolderNames: ['Maintenance', visit.id.slice(0, 8)],
      });
      const kind = item.file.type.startsWith('video/') ? 'video' : 'photo';
      const response = await fetch(`/api/crm/maintenance/visits/${visit.id}/media`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driveFileId: saved.id,
          phase: mediaPhase,
          kind,
          caption: item.caption,
          orientation,
        }),
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || t('mediaFailed'));
      }
    }
    await loadMediaMeta(visit.id);
  }

  function toggleService(id: string) {
    setSelectedServiceIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  function toggleWorker(id: string) {
    setWorkerCrewIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  async function addCustomService() {
    const name = newServiceName.trim();
    if (!name) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/crm/maintenance/services', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || t('serviceAddFailed'));
      setServices((prev) => {
        if (prev.some((service) => service.id === body.service.id)) return prev;
        return [...prev, body.service];
      });
      setSelectedServiceIds((prev) => (prev.includes(body.service.id) ? prev : [...prev, body.service.id]));
      setNewServiceName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('serviceAddFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function inviteCrew() {
    if (!inviteName.trim() || !inviteEmail.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/crm/maintenance/crew', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: inviteName.trim(),
          email: inviteEmail.trim(),
          memberRole: 'crew',
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || t('inviteFailed'));
      setCrew((prev) => [...prev.filter((item) => item.id !== body.crew.id), body.crew]);
      setWorkerCrewIds((prev) => (prev.includes(body.crew.id) ? prev : [...prev, body.crew.id]));
      setInviteName('');
      setInviteEmail('');
      setShowInvite(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('inviteFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function finishVisit() {
    if (!visit) return;
    if (beforeCount < 1) {
      setError(t('needBeforeMedia'));
      return;
    }
    if (selectedServiceIds.length < 1) {
      setError(t('needServices'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/crm/maintenance/visits/${visit.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes,
          serviceOptionIds: selectedServiceIds,
          workerCount: visit.workerCount,
          finish: true,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || t('finishFailed'));
      setVisit(toVisitState(body.visit, visit.customerName));
      setStep('done');
      void loadLists();
      void loadDay();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('finishFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function startTrip() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/crm/maintenance/days', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start_trip', fromVisitId: visit?.status === 'completed' ? visit.id : undefined }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || t('tripFailed'));
      await loadDay();
      // Next stop: go straight to setup so arriving = pick customer + start clock.
      resetWizard({ keepOpen: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('tripFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function endDay() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/crm/maintenance/days', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'end_day' }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || t('endDayFailed'));
      setClosedDay(body.day ?? null);
      setDay(null);
      setTrips([]);
      setConfirmEndDay(false);
      resetWizard();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('endDayFailed'));
    } finally {
      setBusy(false);
    }
  }

  function resetWizard(opts?: { keepOpen?: boolean }) {
    setShowWizard(Boolean(opts?.keepOpen));
    setStep('setup');
    setVisit(null);
    setSelectedCustomerId('');
    setSelectedPlanId('');
    setSelectedServiceIds([]);
    setNotes('');
    setBeforeCount(0);
    setAfterCount(0);
    setError(null);
    if (!opts?.keepOpen) onCloseAutoStart?.();
  }

  const openTripSeconds = openTrip ? secondsSince(openTrip.startedAt, now) : 0;

  const renderDaySummary = (summary: DayState, live: boolean) => {
    const totalSpan = summary.endedAt
      ? secondsSince(summary.startedAt, new Date(summary.endedAt).getTime())
      : secondsSince(summary.startedAt, now);
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label={t('dayVisits')} value={String(summary.visitCount)} />
        <Stat label={t('dayOnSite')} value={formatDurationClock(summary.totalVisitSeconds)} />
        <Stat label={t('dayLabor')} value={formatLaborHours(summary.totalLaborSeconds)} />
        <Stat label={t('dayBreaks')} value={formatDurationClock(summary.totalBreakSeconds)} />
        <Stat
          label={t('dayTravel')}
          value={`${formatDurationClock(summary.totalTripSeconds + (live ? openTripSeconds : 0))} · ${summary.tripCount}`}
        />
        <Stat label={t('dayTotal')} value={formatDurationClock(totalSpan)} />
      </div>
    );
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">{headerStart}</div>
        <DeleteConfirmModal
        isOpen={deletingVisitId !== null}
        title={t('deleteVisit')}
        message={t('deleteVisitConfirm')}
        onCancel={() => setDeletingVisitId(null)}
        onConfirm={() => void confirmDeleteVisit()}
        busy={deletingBusy}
        error={deleteError}
      />

      {!showWizard && (
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => {
              setShowWizard(true);
              setStep('setup');
            }}
            className="flex shrink-0 items-center gap-2 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            {openTrip ? t('arrivedStart') : t('startMaintenance')}
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Work day: totals, travel between places, end of day */}
      {day && (
        <section className="space-y-3 rounded-xl border-2 border-black p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">
              {t('dayTitle')} · {new Date(day.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </h2>
            {openTrip && (
              <span className="inline-flex items-center gap-1 rounded-full bg-black px-3 py-1 text-sm text-white">
                <Car className="h-4 w-4" />
                {t('traveling')} {formatDurationClock(openTripSeconds)}
              </span>
            )}
          </div>
          {renderDaySummary(day, true)}
          {!visitRunning && (
            <div className="flex flex-wrap gap-2">
              {!openTrip && day.visitCount > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void startTrip()}
                  className="rounded-full border-2 border-black"
                >
                  <Car className="h-4 w-4 mr-1" />
                  {t('startTrip')}
                </Button>
              )}
              {confirmEndDay ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm">{t('endDayConfirm')}</span>
                  <Button type="button" disabled={busy} onClick={() => void endDay()} className="rounded-full">
                    {t('endDay')}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setConfirmEndDay(false)} className="rounded-full">
                    {t('cancel')}
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setConfirmEndDay(true)}
                  className="rounded-full border-2 border-black"
                >
                  <Flag className="h-4 w-4 mr-1" />
                  {t('endDay')}
                </Button>
              )}
            </div>
          )}
        </section>
      )}

      {closedDay && !day && (
        <section className="space-y-3 rounded-xl border-2 border-black bg-gray-50 p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">{t('dayEndedTitle')}</h2>
            <button type="button" onClick={() => setClosedDay(null)} className="p-1" aria-label={t('cancel')}>
              <X className="h-5 w-5" />
            </button>
          </div>
          {renderDaySummary(closedDay, false)}
          <p className="text-xs text-gray-600">{t('laborHint')}</p>
        </section>
      )}

      {!showWizard && (
        <ul className="space-y-2">
          {visits.length === 0 && <li className="text-sm text-gray-600">{t('empty')}</li>}
          {visits.map((item) => (
            <li key={item.id} className="border-2 border-black rounded-lg px-3 py-2 flex items-center justify-between gap-2">
              <a href={`/${locale}/crm/maintenance/visits/${item.id}`} className="min-w-0 flex-1 hover:underline">
                <div className="font-medium">{item.customerName}</div>
                <div className="text-xs text-gray-600">
                  {t(`status_${item.status}` as 'status_completed')} · {new Date(item.startedAt).toLocaleString()}
                  {item.durationSeconds != null ? ` · ${formatDurationClock(item.durationSeconds)}` : ''}
                  {item.laborSeconds != null
                    ? ` · ${t('workersShort', { count: item.workerCount })} · ${formatLaborHours(item.laborSeconds)} ${t('laborShort')}`
                    : ''}
                </div>
              </a>
              {item.status === 'completed' && (
                <a
                  className="underline text-sm inline-flex items-center gap-1"
                  href={`/api/crm/maintenance/visits/${item.id}/pdf`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Download className="h-4 w-4" />
                  {t('downloadPdf')}
                </a>
              )}
              {isOpenVisit(item.status) && !visit && (
                <Button type="button" variant="outline" onClick={() => void resumeOpenVisit(item.id)}>
                  {t('resumeVisit')}
                </Button>
              )}
              {visit?.id !== item.id && (
                <button
                  type="button"
                  onClick={() => {
                    setDeleteError(null);
                    setDeletingVisitId(item.id);
                  }}
                  disabled={busy}
                  aria-label={t('deleteVisit')}
                  title={t('deleteVisit')}
                  className="shrink-0 p-1 text-red-600 hover:bg-gray-100 rounded disabled:opacity-40 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {showWizard && step === 'setup' && (
        <div className="space-y-4 border-2 border-black rounded-xl p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{t('setupTitle')}</h2>
            <button type="button" onClick={() => resetWizard()} className="p-1" aria-label={t('cancel')}>
              <X className="h-5 w-5" />
            </button>
          </div>

          <FormField label={t('customer')}>
            <select
              className="w-full border-2 border-black rounded-lg px-3 py-2 text-sm"
              value={selectedCustomerId}
              onChange={(event) => {
                setSelectedCustomerId(event.target.value);
                setSelectedPlanId('');
              }}
            >
              <option value="">{t('chooseCustomer')}</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </FormField>

          {customerPlans.length > 0 && (
            <FormField label={t('plan')}>
              <select
                className="w-full border-2 border-black rounded-lg px-3 py-2 text-sm"
                value={selectedPlanId}
                onChange={(event) => setSelectedPlanId(event.target.value)}
              >
                {customerPlans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>
            </FormField>
          )}

          <FormField label={t('responsible')}>
            <select
              className="w-full border-2 border-black rounded-lg px-3 py-2 text-sm"
              value={responsibleCrewId}
              onChange={(event) => setResponsibleCrewId(event.target.value)}
            >
              <option value="">{t('chooseResponsible')}</option>
              {crew.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.displayName}
                  {member.status === 'invited' ? ` (${t('invited')})` : ''}
                </option>
              ))}
            </select>
          </FormField>

          <div className="space-y-2">
            <div className="font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              {t('crewOnSite')}
            </div>
            {crew.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {crew.map((member) => {
                  const active = workerCrewIds.includes(member.id) || responsibleCrewId === member.id;
                  return (
                    <button
                      key={member.id}
                      type="button"
                      disabled={responsibleCrewId === member.id}
                      onClick={() => toggleWorker(member.id)}
                      className={`rounded-full border-2 border-black px-3 py-1.5 text-sm ${
                        active ? 'bg-black text-white' : 'bg-white'
                      }`}
                    >
                      {active && <Check className="inline h-3.5 w-3.5 mr-1" />}
                      {member.displayName}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-black/15 p-3">
              <div>
                <div className="text-sm font-medium">{t('extraWorkers')}</div>
                <div className="text-xs text-gray-600">{t('extraWorkersHint')}</div>
              </div>
              <WorkerStepper value={extraWorkers} min={0} onChange={setExtraWorkers} label={t('extraWorkers')} />
            </div>
            <p className="text-sm font-medium">{t('workersOnSite', { count: setupWorkerCount })}</p>
          </div>

          <button
            type="button"
            className="text-sm underline inline-flex items-center gap-1"
            onClick={() => setShowInvite((open) => !open)}
          >
            <UserPlus className="h-4 w-4" />
            {t('inviteCrew')}
          </button>

          {showInvite && (
            <div className="space-y-2 rounded-lg border border-black/20 p-3">
              <Input value={inviteName} onChange={(event) => setInviteName(event.target.value)} placeholder={t('crewName')} />
              <Input value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder={t('crewEmail')} />
              <Button type="button" disabled={busy} onClick={() => void inviteCrew()}>
                {t('sendInvite')}
              </Button>
            </div>
          )}

          {openTrip && <p className="text-xs text-gray-600">{t('arrivalEndsTrip')}</p>}

          <Button type="button" disabled={busy} onClick={() => void startVisit()} className="w-full rounded-full inline-flex items-center justify-center gap-2">
            <Play className="h-4 w-4 shrink-0" />
            {t('startClock')}
          </Button>
        </div>
      )}

      {showWizard && step === 'active' && visit && (
        <div className="space-y-4 border-2 border-black rounded-xl p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-semibold">{visit.customerName}</div>
              <div className={`text-3xl font-mono tabular-nums ${visit.status === 'on_break' ? 'text-gray-400' : ''}`}>
                {formatDurationClock(activeSeconds)}
              </div>
              {visit.status === 'on_break' ? (
                <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-sm font-medium text-amber-900">
                  <Coffee className="h-4 w-4" />
                  {t('onBreak')} {formatDurationClock(currentBreakSeconds)}
                </div>
              ) : visit.breakSeconds > 0 ? (
                <div className="mt-1 text-xs text-gray-600">
                  {t('breaksSoFar')} {formatDurationClock(visit.breakSeconds)}
                </div>
              ) : null}
            </div>
            <button type="button" onClick={() => resetWizard()} className="p-1" aria-label={t('cancel')}>
              <X className="h-5 w-5" />
            </button>
          </div>

          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void toggleBreak()}
            className="w-full rounded-full border-2 border-black"
          >
            {visit.status === 'on_break' ? (
              <>
                <Play className="h-4 w-4 mr-1" />
                {t('resumeWork')}
              </>
            ) : (
              <>
                <Coffee className="h-4 w-4 mr-1" />
                {t('takeBreak')}
              </>
            )}
          </Button>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-black/15 p-3">
            <div>
              <div className="text-sm font-medium">{t('workersLabel')}</div>
              <div className="text-xs text-gray-600">
                {t('laborLive', { hours: formatLaborHours(liveLaborSeconds) })}
              </div>
            </div>
            <WorkerStepper
              value={visit.workerCount}
              onChange={(next) => void updateWorkerCount(next)}
              disabled={busy}
              label={t('workersLabel')}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl border-2 border-black"
              onClick={() => {
                void primeLiveCamera();
                setMediaPhase('before');
              }}
            >
              <Camera className="h-4 w-4 mr-1" />
              {t('beforeMedia')} ({beforeCount})
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl border-2 border-black"
              onClick={() => {
                void primeLiveCamera();
                setMediaPhase('after');
              }}
            >
              <Camera className="h-4 w-4 mr-1" />
              {t('afterMedia')} ({afterCount})
            </Button>
          </div>

          <div>
            <div className="font-medium mb-2">{t('services')}</div>
            <div className="flex flex-wrap gap-2">
              {services.map((service) => {
                const active = selectedServiceIds.includes(service.id);
                return (
                  <button
                    key={service.id}
                    type="button"
                    onClick={() => toggleService(service.id)}
                    className={`rounded-lg border-2 px-3 py-1.5 text-sm ${
                      active ? 'border-black bg-black text-white' : 'border-black bg-white'
                    }`}
                  >
                    {active && <Check className="inline h-3.5 w-3.5 mr-1" />}
                    {service.name}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex gap-2">
              <Input
                value={newServiceName}
                onChange={(event) => setNewServiceName(event.target.value)}
                placeholder={t('addServicePlaceholder')}
              />
              <Button type="button" disabled={busy} onClick={() => void addCustomService()}>
                {t('addService')}
              </Button>
            </div>
          </div>

          {visit.customerId && <MaintenancePlantsPanel customerId={visit.customerId} planId={visit.maintenancePlanId} businessId={businessId} />}

          <FormField label={t('notes')}>
            <textarea
              className="w-full border-2 border-black rounded-lg px-3 py-2 text-sm"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={4}
              placeholder={t('notesPlaceholder')}
            />
          </FormField>

          <Button type="button" disabled={busy} onClick={() => void finishVisit()} className="w-full rounded-full">
            {t('finishMaintenance')}
          </Button>
        </div>
      )}

      {showWizard && step === 'done' && visit && (
        <div className="space-y-4 border-2 border-black rounded-xl p-4">
          <h2 className="font-semibold">{t('reportReady')}</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label={t('dayOnSite')} value={formatDurationClock(visit.durationSeconds ?? 0)} />
            <Stat label={t('dayBreaks')} value={formatDurationClock(visit.breakSeconds)} />
            <Stat label={t('workersLabel')} value={String(visit.workerCount)} />
            <Stat label={t('dayLabor')} value={formatLaborHours(visit.laborSeconds ?? 0)} />
          </div>
          <p className="text-sm whitespace-pre-wrap">{visit.generatedDescription}</p>
          <div className="flex flex-wrap gap-2">
            <a
              className="inline-flex items-center gap-1 rounded-full border-2 border-black bg-black px-4 py-2 text-sm font-medium text-white"
              href={`/${locale}/crm/maintenance/visits/${visit.id}`}
            >
              View report
            </a>
            <a
              className="inline-flex items-center gap-1 rounded-full border-2 border-black px-4 py-2 text-sm font-medium"
              href={`/api/crm/maintenance/visits/${visit.id}/pdf`}
              target="_blank"
              rel="noreferrer"
            >
              <Download className="h-4 w-4" />
              {t('downloadPdf')}
            </a>
          </div>
          <div className="space-y-2 border-t border-black/15 pt-3">
            <p className="text-sm font-medium">{t('whatNext')}</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" disabled={busy} onClick={() => void startTrip()} className="rounded-full">
                <Car className="h-4 w-4 mr-1" />
                {t('startTrip')}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void endDay()}
                className="rounded-full border-2 border-black"
              >
                <Flag className="h-4 w-4 mr-1" />
                {t('endDayLast')}
              </Button>
              <Button type="button" variant="outline" onClick={() => resetWizard()}>
                {t('backToList')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {mediaPhase && visit && (
        <JobCameraSession
          open
          mode="job"
          title={mediaPhase === 'before' ? t('beforeMedia') : t('afterMedia')}
          subtitle={visit.customerName}
          begin="video"
          onBack={() => setMediaPhase(null)}
          onFinished={() => setMediaPhase(null)}
          onSave={saveCameraItems}
        />
      )}

      <p className="text-xs text-gray-500">
        {t('crewHint')}{' '}
        <a className="underline" href={`/${locale}/crm/maintenance`}>
          /crm/maintenance
        </a>
      </p>
    </div>
  );
}
