'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { ArrowLeft, Download, Mail, MapPin, Phone, Play } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  HouseAgreementForm,
  houseAgreementError,
  houseAgreementPayload,
  type HouseAgreementValues,
} from '@/components/maintenance/HouseAgreementForm';
import { MaintenancePlantsPanel } from '@/components/maintenance/MaintenancePlantsPanel';
import { isMaintenanceFrequency, MAINTENANCE_FREQUENCY_LABELS } from '@/lib/crm/estimate-agreement';
import { maintenanceHouseStatusLabel, type MaintenanceHouseStatus } from '@/lib/crm/list-charts';
import { formatDurationClock } from '@/lib/crm/maintenance-defaults';
import type { ContactProperty } from '@/lib/places/contact-places';

interface House {
  id: string;
  customerId: string;
  customerName: string;
  phone: string | null;
  email: string | null;
  placeId: string | null;
  placeName: string | null;
  address: string;
  status: MaintenanceHouseStatus;
  name: string;
  frequency: string;
  amountCents: number | null;
  nextVisitDate: string | null;
  endDate: string | null;
  isActive: boolean;
  scopeOfWork: string | null;
  accessNotes: string | null;
  fromEstimate: boolean;
}

interface Visit {
  id: string;
  status: string;
  startedAt: string;
  durationSeconds: number | null;
  laborSeconds: number | null;
  workerCount: number;
}

function toValues(house: House): HouseAgreementValues {
  return {
    placeId: house.placeId ?? '',
    name: house.name,
    frequency: isMaintenanceFrequency(house.frequency) ? house.frequency : 'monthly',
    amount: house.amountCents == null ? '' : (house.amountCents / 100).toFixed(2),
    nextVisitDate: house.nextVisitDate ?? '',
    endDate: house.endDate ?? '',
    scopeOfWork: house.scopeOfWork ?? '',
    accessNotes: house.accessNotes ?? '',
  };
}

function statusLabel(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function MaintenanceHousePage() {
  const locale = useLocale();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const justAdded = searchParams.get('added') === '1';
  const backHref = `/${locale}/crm/maintenance`;

  const [house, setHouse] = useState<House | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [values, setValues] = useState<HouseAgreementValues | null>(null);
  const [properties, setProperties] = useState<ContactProperty[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const res = await fetch(`/api/crm/maintenance/houses/${id}?timeZone=${encodeURIComponent(timeZone)}`, {
      credentials: 'include',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Could not load the house');
    return data as { house: House; visits: Visit[]; businessId: string | null; canEdit: boolean };
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((data) => {
        if (cancelled) return;
        setHouse(data.house);
        setVisits(data.visits);
        setBusinessId(data.businessId);
        setCanEdit(data.canEdit);
        setValues(toValues(data.house));
      })
      .catch((err: unknown) => !cancelled && setLoadError(err instanceof Error ? err.message : 'Could not load the house'));
    return () => {
      cancelled = true;
    };
  }, [load]);

  const save = async (extra?: { isActive: boolean }) => {
    if (!values || saving) return;
    const invalid = houseAgreementError(values);
    if (invalid) {
      setSaveError(invalid);
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/crm/maintenance/houses/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...houseAgreementPayload(values, properties), ...extra }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Could not save');
      const fresh = await load();
      setHouse(fresh.house);
      setValues(toValues(fresh.house));
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const startVisit = () => {
    if (!house) return;
    const query = new URLSearchParams({ new: '1', customerId: house.customerId, planId: house.id });
    router.push(`${backHref}?${query}`);
  };

  if (loadError) {
    return (
      <div className="w-full md:max-w-2xl md:mx-auto space-y-4 py-4">
        <Link href={backHref} className="flex items-center gap-2 text-gray-700 hover:text-black font-medium">
          <ArrowLeft className="w-5 h-5" /> Back
        </Link>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{loadError}</div>
      </div>
    );
  }
  if (!house || !values) {
    return <div className="p-12 text-center text-sm text-gray-500">Loading house…</div>;
  }

  const mapsUrl = house.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(house.address)}`
    : null;

  return (
    <div className="w-full md:max-w-3xl md:mx-auto space-y-4 pb-24">
      <div className="py-2 flex items-center justify-between gap-4">
        <Link href={backHref} className="flex items-center gap-2 text-gray-700 hover:text-black font-medium">
          <ArrowLeft className="w-5 h-5 shrink-0" /> Houses
        </Link>
        {house.isActive ? (
          <Button variant="primary" size="sm" className="flex items-center gap-2 shrink-0" onClick={startVisit}>
            <Play className="w-4 h-4" />
            Start visit
          </Button>
        ) : null}
      </div>

      {justAdded ? (
        <div className="rounded-lg border-2 border-green-600 bg-green-50 p-3 text-sm text-green-800">
          House added. Now add the plants at this house below.
        </div>
      ) : null}

      <section className="rounded-lg border-2 border-black bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-semibold text-gray-900">{house.customerName}</h1>
            <p className="text-sm text-gray-600">
              {[house.placeName, house.address].filter(Boolean).join(' · ') || 'No address on file'}
            </p>
            <p className="mt-1 text-sm text-gray-900">
              {house.name}
              {isMaintenanceFrequency(house.frequency) ? ` · ${MAINTENANCE_FREQUENCY_LABELS[house.frequency]}` : ''}
            </p>
          </div>
          <span className="inline-flex items-center rounded-md border border-black px-2 py-0.5 text-xs font-medium">
            {maintenanceHouseStatusLabel(house.status)}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={`/${locale}/crm/maintenance/houses/${house.id}/financials`}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border-2 border-black px-3 text-sm font-medium hover:bg-gray-50"
          >
            Financial report
          </Link>
          {house.phone ? (
            <a href={`tel:${house.phone}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border-2 border-black px-3 text-sm hover:bg-gray-50">
              <Phone className="h-4 w-4" /> Call
            </a>
          ) : null}
          {house.email ? (
            <a href={`mailto:${house.email}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg border-2 border-black px-3 text-sm hover:bg-gray-50">
              <Mail className="h-4 w-4" /> Email
            </a>
          ) : null}
          {mapsUrl ? (
            <a href={mapsUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg border-2 border-black px-3 text-sm hover:bg-gray-50">
              <MapPin className="h-4 w-4" /> Map
            </a>
          ) : null}
        </div>
        {house.fromEstimate ? (
          <p className="mt-2 text-xs text-gray-500">Started from an accepted maintenance estimate.</p>
        ) : null}
      </section>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
        className="space-y-4"
      >
        <HouseAgreementForm
          customerId={house.customerId}
          contactAddress={properties.length === 0 ? house.address || 'No address on file' : undefined}
          values={values}
          onChange={(next) => {
            setValues(next);
            setSaved(false);
          }}
          onPropertiesLoaded={setProperties}
          disabled={!canEdit || saving}
        />
        {saveError ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{saveError}</div> : null}
        {saved ? <p className="text-sm text-green-700">Agreement saved.</p> : null}
        {canEdit ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" variant="primary" size="sm" disabled={saving}>
              {saving ? 'Saving…' : 'Save agreement'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={saving}
              onClick={() => void save({ isActive: !house.isActive })}
            >
              {house.isActive ? 'End agreement' : 'Restart agreement'}
            </Button>
          </div>
        ) : (
          <p className="text-xs text-gray-500">Only the business owner can change the agreement.</p>
        )}
      </form>

      <section className="rounded-lg border-2 border-black bg-white p-4">
        <MaintenancePlantsPanel customerId={house.customerId} planId={house.id} businessId={businessId} />
      </section>

      <section className="rounded-lg border-2 border-black bg-white p-4 space-y-3">
        <h2 className="text-base font-semibold text-gray-900">Visits</h2>
        {visits.length === 0 ? (
          <p className="text-sm text-gray-600">No visits at this house yet.</p>
        ) : (
          <ul className="space-y-2">
            {visits.map((visit) => (
              <li key={visit.id} className="flex items-center justify-between gap-2 rounded-lg border border-black/20 px-3 py-2">
                <Link href={`/${locale}/crm/maintenance/visits/${visit.id}`} className="min-w-0 flex-1 text-sm hover:underline">
                  <div className="font-medium">{new Date(visit.startedAt).toLocaleString()}</div>
                  <div className="text-xs text-gray-600">
                    {statusLabel(visit.status)}
                    {visit.durationSeconds != null ? ` · ${formatDurationClock(visit.durationSeconds)} on site` : ''}
                    {visit.laborSeconds != null ? ` · ${visit.workerCount} worker${visit.workerCount === 1 ? '' : 's'}` : ''}
                  </div>
                </Link>
                {visit.status === 'completed' ? (
                  <a
                    className="inline-flex items-center gap-1 text-sm underline"
                    href={`/api/crm/maintenance/visits/${visit.id}/pdf`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Download className="h-4 w-4" /> PDF
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
