'use client';

import { useEffect, useRef, useState } from 'react';
import { contactDisplayName } from '@/lib/crm/contact-name';
import { useSearchParams } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import {
  parseVehicleWrite,
  tripAmountCents,
  tripRateError,
  vehicleCost,
  yearlyDraftFromExpenses,
  type ActualVehicleCost,
  type TripPurpose,
  type VehicleCostBreakdown,
  type VehicleCostInput,
} from '@/lib/crm/mileage-cost';
import { TitleCount } from '@/components/crm/TitleCount';
import { PickerSelect } from '@/components/ui/PickerSelect';
import { TripTracker } from '@/components/crm/mileage/TripTracker';

interface VehicleView {
  id: string;
  name: string;
  note: string | null;
  mpg: number | null;
  fuelPriceCents: number | null;
  annualMiles: number | null;
  averageTripMiles: number | null;
  insuranceCents: number;
  maintenanceCents: number;
  registrationCents: number;
  tiresCents: number;
  depreciationCents: number;
  otherCents: number;
  cost: VehicleCostBreakdown;
  actual: ActualVehicleCost;
}

interface TripView {
  /** Recorded live with GPS: has a route map. */
  tracked?: boolean;
  id: string;
  vehicleId: string | null;
  vehicleName: string;
  customerId: string | null;
  customerName: string | null;
  estimateId: string | null;
  estimateLabel: string | null;
  projectId: string | null;
  tripDate: string;
  purpose: TripPurpose;
  origin: string | null;
  destination: string | null;
  miles: number;
  costPerMileCents: number;
  amountCents: number;
  note: string | null;
  expenseId: string | null;
  billed: boolean;
}

interface Draft {
  name: string;
  mpg: string;
  fuelPrice: string;
  annualMiles: string;
  averageTripMiles: string;
  insurance: string;
  maintenance: string;
  registration: string;
  tires: string;
  depreciation: string;
  other: string;
  note: string;
}

interface CustomerOption {
  id: string;
  name: string;
  address: string;
}

interface EstimateOption {
  id: string;
  customerId: string;
  label: string;
  address: string;
}

interface TripDraft {
  id: string | null;
  vehicleId: string;
  customerId: string;
  estimateId: string;
  projectId: string;
  tripDate: string;
  purpose: TripPurpose;
  origin: string;
  destination: string;
  miles: string;
  note: string;
}

const PURPOSES: { value: TripPurpose; label: string }[] = [
  { value: 'job', label: 'Job' },
  { value: 'estimate', label: 'Estimate visit' },
  { value: 'supply_run', label: 'Supply run' },
  { value: 'other', label: 'Other' },
];

const EMPTY_DRAFT: Draft = {
  name: '',
  mpg: '',
  fuelPrice: '',
  annualMiles: '',
  averageTripMiles: '',
  insurance: '',
  maintenance: '',
  registration: '',
  tires: '',
  depreciation: '',
  other: '',
  note: '',
};

function money(cents: number | null, digits = 2): string {
  if (cents == null || !Number.isFinite(cents)) return '—';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(cents / 100);
}

function centsToInput(cents: number): string {
  if (!cents) return '';
  return (cents / 100).toFixed(2);
}

function numberToInput(value: number | null): string {
  if (value == null) return '';
  return String(value);
}

function draftFromVehicle(vehicle: VehicleView): Draft {
  return {
    name: vehicle.name,
    mpg: numberToInput(vehicle.mpg),
    fuelPrice: vehicle.fuelPriceCents == null ? '' : (vehicle.fuelPriceCents / 100).toFixed(2),
    annualMiles: numberToInput(vehicle.annualMiles),
    averageTripMiles: numberToInput(vehicle.averageTripMiles),
    insurance: centsToInput(vehicle.insuranceCents),
    maintenance: centsToInput(vehicle.maintenanceCents),
    registration: centsToInput(vehicle.registrationCents),
    tires: centsToInput(vehicle.tiresCents),
    depreciation: centsToInput(vehicle.depreciationCents),
    other: centsToInput(vehicle.otherCents),
    note: vehicle.note ?? '',
  };
}

function optionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const amount = Number(trimmed);
  return Number.isFinite(amount) ? amount : null;
}

function dollarsToCents(value: string): number {
  const amount = optionalNumber(value);
  if (amount == null || amount < 0) return 0;
  return Math.round(amount * 100);
}

function previewInput(draft: Draft): VehicleCostInput {
  const fuel = optionalNumber(draft.fuelPrice);
  return {
    mpg: optionalNumber(draft.mpg),
    fuelPriceCents: fuel == null || fuel < 0 ? null : Math.round(fuel * 100),
    annualMiles: optionalNumber(draft.annualMiles),
    averageTripMiles: optionalNumber(draft.averageTripMiles),
    insuranceCents: dollarsToCents(draft.insurance),
    maintenanceCents: dollarsToCents(draft.maintenance),
    registrationCents: dollarsToCents(draft.registration),
    tiresCents: dollarsToCents(draft.tires),
    depreciationCents: dollarsToCents(draft.depreciation),
    otherCents: dollarsToCents(draft.other),
  };
}

function draftPayload(draft: Draft) {
  const fuel = optionalNumber(draft.fuelPrice);
  return {
    name: draft.name,
    mpg: optionalNumber(draft.mpg),
    fuelPriceCents: fuel == null ? null : Math.round(fuel * 100),
    annualMiles: optionalNumber(draft.annualMiles),
    averageTripMiles: optionalNumber(draft.averageTripMiles),
    insuranceCents: dollarsToCents(draft.insurance),
    maintenanceCents: dollarsToCents(draft.maintenance),
    registrationCents: dollarsToCents(draft.registration),
    tiresCents: dollarsToCents(draft.tires),
    depreciationCents: dollarsToCents(draft.depreciation),
    otherCents: dollarsToCents(draft.other),
    note: draft.note,
  };
}

function placeLine(parts: Array<string | null | undefined>): string {
  return parts.map((part) => part?.trim() ?? '').filter(Boolean).join(', ');
}

async function fetchMileageBundle(): Promise<{
  vehicles: VehicleView[];
  trips: TripView[];
  projects: { id: string; name: string }[];
  customers: CustomerOption[];
  estimates: EstimateOption[];
  windowLabel: string;
}> {
  const [vehicleRes, tripRes, projectRes, customerRes, estimateRes] = await Promise.all([
    fetch('/api/crm/vehicles', { credentials: 'include' }),
    fetch('/api/crm/mileage/trips', { credentials: 'include' }),
    fetch('/api/crm/projects?pageSize=500', { credentials: 'include' }),
    fetch('/api/crm/customers?pageSize=500', { credentials: 'include' }),
    fetch('/api/crm/estimates?pageSize=100', { credentials: 'include' }),
  ]);
  const vehicleData = await vehicleRes.json().catch(() => ({}));
  const tripData = await tripRes.json().catch(() => ({}));
  const projectData = await projectRes.json().catch(() => ({}));
  const customerData = await customerRes.json().catch(() => ({}));
  const estimateData = await estimateRes.json().catch(() => ({}));
  if (!vehicleRes.ok) throw new Error(vehicleData.error || 'Failed to load vehicles');
  if (!tripRes.ok) throw new Error(tripData.error || 'Failed to load trips');
  const customers = (customerRes.ok ? customerData.customers ?? [] : []).map((customer: {
    id: string;
    display_name?: string | null;
    company_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    street_address?: string | null;
    city?: string | null;
    state?: string | null;
    zip_code?: string | null;
  }) => ({
    id: customer.id,
    name: contactDisplayName(customer),
    address: placeLine([customer.street_address, customer.city, customer.state, customer.zip_code]),
  })).sort((a: CustomerOption, b: CustomerOption) => a.name.localeCompare(b.name));
  const estimates = (estimateRes.ok ? estimateData.estimates ?? [] : []).map((estimate: {
    id: string;
    display_id?: string | null;
    customer_id: string;
    status?: string | null;
    customerDisplayName?: string | null;
    customerAddress?: string | null;
  }) => ({
    id: estimate.id,
    customerId: estimate.customer_id,
    label: [estimate.display_id || 'Estimate', estimate.customerDisplayName, estimate.status].filter(Boolean).join(' · '),
    address: estimate.customerAddress ?? '',
  }));
  return {
    vehicles: (vehicleData.vehicles ?? []) as VehicleView[],
    trips: (tripData.trips ?? []) as TripView[],
    projects: (projectData.projects ?? []) as { id: string; name: string }[],
    customers,
    estimates,
    windowLabel: vehicleData.from && vehicleData.to ? `${vehicleData.from} to ${vehicleData.to}` : '',
  };
}

function todayKey(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function emptyTrip(vehicle?: VehicleView): TripDraft {
  return {
    id: null,
    vehicleId: vehicle?.id ?? '',
    customerId: '',
    estimateId: '',
    projectId: '',
    tripDate: todayKey(),
    purpose: 'job',
    origin: '',
    destination: '',
    miles: vehicle?.averageTripMiles != null ? String(vehicle.averageTripMiles) : '',
    note: '',
  };
}

export default function CRMMileagePage() {
  const searchParams = useSearchParams();
  const [vehicles, setVehicles] = useState<VehicleView[]>([]);
  const [trips, setTrips] = useState<TripView[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [estimates, setEstimates] = useState<EstimateOption[]>([]);
  const [windowLabel, setWindowLabel] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [trip, setTrip] = useState<TripDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const openedNewTrip = useRef(false);

  const applyBundle = (bundle: Awaited<ReturnType<typeof fetchMileageBundle>>, keepId?: string | null) => {
    setVehicles(bundle.vehicles);
    setTrips(bundle.trips);
    setProjects(bundle.projects);
    setCustomers(bundle.customers);
    setEstimates(bundle.estimates);
    if (bundle.windowLabel) setWindowLabel(bundle.windowLabel);
    if (!openedNewTrip.current && searchParams.get('new') === '1') {
      openedNewTrip.current = true;
      const ready = bundle.vehicles.find((item) => item.cost.ready);
      if (ready) setTrip(emptyTrip(ready));
    }
    const id = keepId === undefined ? selectedId : keepId;
    if (id === 'new') return;
    const match = bundle.vehicles.find((item) => item.id === id) ?? bundle.vehicles[0];
    if (match) {
      setSelectedId(match.id);
      setDraft(draftFromVehicle(match));
    } else {
      setSelectedId(null);
      setDraft(EMPTY_DRAFT);
    }
  };

  const load = async (keepId?: string | null) => {
    applyBundle(await fetchMileageBundle(), keepId);
  };

  useEffect(() => {
    let cancelled = false;
    fetchMileageBundle()
      .then((bundle) => {
        if (!cancelled) applyBundle(bundle, null);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load mileage');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Load once. Later saves call load().
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = vehicles.find((item) => item.id === selectedId) ?? null;
  const preview = vehicleCost(previewInput(draft));
  const tripVehicle = vehicles.find((item) => item.id === trip?.vehicleId) ?? null;
  const tripMiles = trip ? optionalNumber(trip.miles) : null;
  const tripPreview = tripVehicle?.cost.costPerMileCents != null && tripMiles != null && tripMiles > 0
    ? tripAmountCents(tripMiles, tripVehicle.cost.costPerMileCents)
    : null;
  const savedRate = selected?.cost.costPerMileCents ?? null;
  const draftRate = preview.costPerMileCents;
  const rateDirty = selected != null && draftRate != null && savedRate != null && Math.abs(draftRate - savedRate) > 0.05;

  const setField = (key: keyof Draft, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const selectVehicle = (vehicle: VehicleView) => {
    setSelectedId(vehicle.id);
    setDraft(draftFromVehicle(vehicle));
    setConfirmDelete(false);
    setError(null);
  };

  const saveVehicle = async () => {
    const parsed = parseVehicleWrite(draftPayload(draft));
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const creating = selectedId === 'new' || !selected;
      const res = await fetch(creating ? '/api/crm/vehicles' : `/api/crm/vehicles/${selectedId}`, {
        method: creating ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(parsed.value),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save the vehicle');
      await load(typeof data.id === 'string' ? data.id : selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save the vehicle');
    } finally {
      setSaving(false);
    }
  };

  const removeVehicle = async () => {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/crm/vehicles/${selected.id}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to delete the vehicle');
      setConfirmDelete(false);
      await load(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete the vehicle');
    } finally {
      setSaving(false);
    }
  };

  const copyExpenses = () => {
    if (!selected) return;
    const copied = yearlyDraftFromExpenses(selected.actual.byCategory);
    setDraft((current) => ({
      ...current,
      insurance: centsToInput(copied.insuranceCents),
      maintenance: centsToInput(copied.maintenanceCents),
      registration: centsToInput(copied.registrationCents),
      tires: centsToInput(copied.tiresCents),
      depreciation: centsToInput(copied.depreciationCents),
      other: centsToInput(copied.otherCents),
    }));
  };

  const saveTrip = async () => {
    if (!trip) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        vehicleId: trip.vehicleId,
        customerId: trip.customerId || null,
        estimateId: trip.estimateId || null,
        projectId: trip.projectId || null,
        tripDate: trip.tripDate,
        purpose: trip.purpose,
        origin: trip.origin,
        destination: trip.destination,
        miles: optionalNumber(trip.miles),
        note: trip.note,
      };
      const res = await fetch(trip.id ? `/api/crm/mileage/trips/${trip.id}` : '/api/crm/mileage/trips', {
        method: trip.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save the trip');
      setTrip(null);
      await load(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save the trip');
    } finally {
      setSaving(false);
    }
  };

  const removeTrip = async (id: string) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/crm/mileage/trips/${id}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to delete the trip');
      if (trip?.id === id) setTrip(null);
      await load(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete the trip');
    } finally {
      setSaving(false);
    }
  };

  const yearlyExpenseCents = selected
    ? Object.values(yearlyDraftFromExpenses(selected.actual.byCategory)).reduce((sum, cents) => sum + cents, 0)
    : 0;

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 md:text-2xl inline-flex items-center gap-2">
                Mileage
                <TitleCount count={trips.length} />
              </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Enter the vehicle, gas, and yearly costs. An average trip and each logged drive are priced from those numbers.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            setSelectedId('new');
            setDraft(EMPTY_DRAFT);
            setConfirmDelete(false);
          }}
        >
          <Plus className="mr-1 inline h-4 w-4" />
          Add vehicle
        </Button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
      {!loading ? (
        <TripTracker
          vehicles={vehicles.map((vehicle) => ({ id: vehicle.id, name: vehicle.name }))}
          customers={customers.map((customer) => ({ id: customer.id, name: customer.name }))}
          costPerMileCents={(id) => vehicles.find((vehicle) => vehicle.id === id)?.cost.costPerMileCents ?? null}
          onSaved={() => void load(selectedId)}
        />
      ) : null}
      {loading ? (
        <div className="p-12 text-center text-sm text-gray-500">Loading mileage…</div>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto">
            {vehicles.map((vehicle) => (
              <button
                key={vehicle.id}
                type="button"
                onClick={() => selectVehicle(vehicle)}
                className={`shrink-0 cursor-pointer rounded-lg border-2 px-3 py-2 text-sm font-medium ${selectedId === vehicle.id ? 'border-black bg-black text-white' : 'border-black bg-white text-black'}`}
              >
                {vehicle.name}
              </button>
            ))}
            {vehicles.length === 0 && <p className="text-sm text-gray-500">Add a truck or car to start a cost.</p>}
          </div>

          <section className="rounded-lg border-2 border-black bg-white p-4">
            <h2 className="text-base font-semibold text-gray-900">{selected ? selected.name : 'New vehicle'}</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Vehicle" required>
                <Input value={draft.name} onChange={(event) => setField('name', event.target.value)} placeholder="Work truck" />
              </FormField>
              <FormField label="Average miles per gallon" tip="How far this vehicle goes on one gallon, on the driving you actually do.">
                <Input inputMode="decimal" value={draft.mpg} onChange={(event) => setField('mpg', event.target.value)} placeholder="18" />
              </FormField>
              <FormField label="Gas price per gallon ($)" tip="Use 0 if you are not counting fuel in this cost.">
                <Input inputMode="decimal" value={draft.fuelPrice} onChange={(event) => setField('fuelPrice', event.target.value)} placeholder="3.60" />
              </FormField>
              <FormField label="Miles driven in a year" tip="Spreads insurance, tires, and the other yearly amounts across every mile.">
                <Input inputMode="decimal" value={draft.annualMiles} onChange={(event) => setField('annualMiles', event.target.value)} placeholder="15000" />
              </FormField>
              <FormField label="Miles on an average trip" tip="A typical drive, one way or round trip, whichever you want the average to mean.">
                <Input inputMode="decimal" value={draft.averageTripMiles} onChange={(event) => setField('averageTripMiles', event.target.value)} placeholder="24" />
              </FormField>
              <FormField label="Insurance per year ($)">
                <Input inputMode="decimal" value={draft.insurance} onChange={(event) => setField('insurance', event.target.value)} placeholder="0.00" />
              </FormField>
              <FormField label="Maintenance and repairs per year ($)">
                <Input inputMode="decimal" value={draft.maintenance} onChange={(event) => setField('maintenance', event.target.value)} placeholder="0.00" />
              </FormField>
              <FormField label="Registration per year ($)">
                <Input inputMode="decimal" value={draft.registration} onChange={(event) => setField('registration', event.target.value)} placeholder="0.00" />
              </FormField>
              <FormField label="Tires per year ($)">
                <Input inputMode="decimal" value={draft.tires} onChange={(event) => setField('tires', event.target.value)} placeholder="0.00" />
              </FormField>
              <FormField label="Value lost per year ($)" tip="How much the vehicle is worth less after a year of work.">
                <Input inputMode="decimal" value={draft.depreciation} onChange={(event) => setField('depreciation', event.target.value)} placeholder="0.00" />
              </FormField>
              <FormField label="Other vehicle costs per year ($)">
                <Input inputMode="decimal" value={draft.other} onChange={(event) => setField('other', event.target.value)} placeholder="0.00" />
              </FormField>
              <FormField label="Note">
                <Input value={draft.note} onChange={(event) => setField('note', event.target.value)} placeholder="Optional" />
              </FormField>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={() => void saveVehicle()} disabled={saving}>
                {saving ? 'Saving…' : 'Save vehicle'}
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={copyExpenses} disabled={!selected || yearlyExpenseCents <= 0}>
                Fill yearly costs from expenses
              </Button>
              {selected && !confirmDelete && (
                <Button type="button" size="sm" variant="secondary" onClick={() => setConfirmDelete(true)} disabled={saving}>
                  Delete
                </Button>
              )}
              {confirmDelete && selected && (
                <>
                  <Button type="button" size="sm" className="border-2 border-red-600 bg-red-600 text-white" onClick={() => void removeVehicle()} disabled={saving}>
                    Delete {selected.name}
                  </Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => setConfirmDelete(false)}>
                    Cancel
                  </Button>
                </>
              )}
            </div>
            <p className="mt-3 text-xs text-gray-500">
              Gas stays in miles per gallon and price per gallon. Fill yearly costs copies insurance, repairs, registration, tires, and other vehicle expenses tagged to this vehicle. A trip uses that rate. It does not create a second expense.
            </p>
          </section>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <CostPanel
              title="From these numbers"
              detail={preview.ready ? 'Save the vehicle before a trip uses this rate.' : (tripRateError(preview) ?? 'Add the missing numbers.')}
              perMile={preview.costPerMileCents}
              tripCents={preview.averageTripCents}
              gasPerMile={preview.fuelPerMileCents}
              otherPerMile={preview.fixedPerMileCents}
              gallons={preview.gallonsPerTrip}
              gasTrip={preview.fuelPerTripCents}
            />
            <CostPanel
              title="From tagged expenses"
              detail={actualDetail(selected?.actual ?? null, windowLabel)}
              perMile={selected?.actual.costPerMileCents ?? null}
              tripCents={selected?.actual.averageTripCents ?? null}
              gasPerMile={null}
              otherPerMile={null}
              gallons={null}
              gasTrip={null}
              expenseCents={selected?.actual.expenseCents ?? null}
            />
          </div>

          <section className="rounded-lg border-2 border-black bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-gray-900">Trips</h2>
              {!trip && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setTrip(emptyTrip(selected ?? undefined))}
                  disabled={!vehicles.some((item) => item.cost.ready)}
                >
                  Log a trip
                </Button>
              )}
            </div>
            {rateDirty && (
              <p className="mt-2 text-sm text-gray-600">Save the vehicle first. A trip uses the last saved gas price, miles, and yearly costs.</p>
            )}
            {trip && (
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Vehicle" required>
                  <PickerSelect
                    value={trip.vehicleId}
                    onChange={(value) => setTrip({ ...trip, vehicleId: value })}
                    placeholder={"Select vehicle"}
                    options={vehicles.map((vehicle) => ({ value: String(vehicle.id), label: String(vehicle.name) }))}
                  />
                </FormField>
                <FormField label="Miles" required>
                  <Input inputMode="decimal" value={trip.miles} onChange={(event) => setTrip({ ...trip, miles: event.target.value })} placeholder="24" />
                </FormField>
                <FormField label="Date" required>
                  <Input type="date" value={trip.tripDate} onChange={(event) => setTrip({ ...trip, tripDate: event.target.value })} />
                </FormField>
                <FormField label="Purpose">
                  <Select value={trip.purpose} onChange={(event) => setTrip({ ...trip, purpose: event.target.value as TripPurpose })}>
                    {PURPOSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </Select>
                </FormField>
                <FormField label="From">
                  <Input value={trip.origin} onChange={(event) => setTrip({ ...trip, origin: event.target.value })} placeholder="Shop" />
                </FormField>
                <FormField label="To">
                  <Input value={trip.destination} onChange={(event) => setTrip({ ...trip, destination: event.target.value })} placeholder="Job site" />
                </FormField>
                <FormField label="Customer">
                  <PickerSelect
                    value={trip.customerId}
                    onChange={(value) => {
                      const customerId = value;
                      const chosen = estimates.find((item) => item.id === trip.estimateId);
                      const address = customers.find((item) => item.id === customerId)?.address ?? '';
                      setTrip({
                        ...trip,
                        customerId,
                        estimateId: chosen && chosen.customerId !== customerId ? '' : trip.estimateId,
                        destination: trip.destination || address,
                      });
                    }}
                    noneLabel={"No customer"}
                    options={customers.map((customer) => ({ value: String(customer.id), label: String(customer.name) }))}
                  />
                </FormField>
                <FormField label="Estimate">
                  <PickerSelect
                    value={trip.estimateId}
                    onChange={(value) => {
                      const estimate = estimates.find((item) => item.id === value);
                      setTrip({
                        ...trip,
                        estimateId: value,
                        customerId: estimate?.customerId || trip.customerId,
                        destination: trip.destination || estimate?.address || '',
                      });
                    }}
                    noneLabel={"No estimate"}
                    options={estimates
                      .filter((item) => !trip.customerId || item.customerId === trip.customerId).map((item) => ({ value: String(item.id), label: String(item.label) }))}
                  />
                </FormField>
                <FormField label="Project">
                  <PickerSelect
                    value={trip.projectId}
                    onChange={(value) => setTrip({ ...trip, projectId: value })}
                    noneLabel={"No project"}
                    options={projects.map((project) => ({ value: String(project.id), label: String(project.name) }))}
                  />
                </FormField>
                <FormField label="Note">
                  <Input value={trip.note} onChange={(event) => setTrip({ ...trip, note: event.target.value })} placeholder="Optional" />
                </FormField>
                <div className="sm:col-span-2">
                  <p className="text-sm text-gray-700">
                    {tripVehicle && !tripVehicle.cost.ready
                      ? tripRateError(tripVehicle.cost)
                      : tripPreview != null
                        ? `This trip costs ${money(tripPreview)} at ${money(tripVehicle?.cost.costPerMileCents ?? null, 3)} per mile. It is not added as another expense.`
                        : 'Enter the miles for this drive.'}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button type="button" size="sm" onClick={() => void saveTrip()} disabled={saving}>
                      {saving ? 'Saving…' : trip.id ? 'Save trip' : 'Add trip'}
                    </Button>
                    <Button type="button" size="sm" variant="secondary" onClick={() => setTrip(null)} disabled={saving}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b-2 border-black text-xs uppercase tracking-wide text-gray-500">
                    <th className="py-2 pr-3 font-medium">Date</th>
                    <th className="py-2 pr-3 font-medium">Customer</th>
                    <th className="py-2 pr-3 font-medium">Estimate</th>
                    <th className="py-2 pr-3 font-medium">Vehicle</th>
                    <th className="py-2 pr-3 font-medium">Miles</th>
                    <th className="py-2 pr-3 font-medium">Cost</th>
                    <th className="py-2 pr-3 font-medium">Trip</th>
                    <th className="py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {trips.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-4 text-gray-500">No trips yet.</td>
                    </tr>
                  )}
                  {trips.map((item) => {
                    const route = [item.origin, item.destination].filter(Boolean).join(' → ');
                    const projectName = projects.find((project) => project.id === item.projectId)?.name;
                    return (
                      <tr key={item.id} className="border-b border-gray-200 align-top">
                        <td className="py-3 pr-3 whitespace-nowrap">
                          {formatTripDate(item.tripDate)}
                          {item.tracked ? (
                            <a href={`/api/crm/mileage/trips/${item.id}/map?w=600&h=300`} target="_blank" rel="noreferrer" className="mt-1 block" title="Route map">
                              {/* eslint-disable-next-line @next/next/no-img-element -- private route image from our own API */}
                              <img src={`/api/crm/mileage/trips/${item.id}/map?w=160&h=90`} alt="Route" loading="lazy" className="h-[45px] w-[80px] rounded-md border border-gray-200 object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                              <span className="mt-0.5 inline-block rounded-md bg-black px-1 text-[10px] font-semibold text-white">GPS</span>
                            </a>
                          ) : null}
                        </td>
                        <td className="py-3 pr-3">{item.customerName || '—'}</td>
                        <td className="py-3 pr-3">{item.estimateLabel || '—'}</td>
                        <td className="py-3 pr-3">{item.vehicleName}</td>
                        <td className="py-3 pr-3 whitespace-nowrap">{item.miles}</td>
                        <td className="py-3 pr-3 whitespace-nowrap">{money(item.amountCents)}</td>
                        <td className="py-3 pr-3 text-gray-600">
                          {[purposeLabel(item.purpose), route, projectName].filter(Boolean).join(' · ') || '—'}
                        </td>
                        <td className="py-3">
                          {!item.billed && (
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={() => setTrip({
                                  id: item.id,
                                  vehicleId: item.vehicleId ?? '',
                                  customerId: item.customerId ?? '',
                                  estimateId: item.estimateId ?? '',
                                  projectId: item.projectId ?? '',
                                  tripDate: item.tripDate,
                                  purpose: item.purpose,
                                  origin: item.origin ?? '',
                                  destination: item.destination ?? '',
                                  miles: String(item.miles),
                                  note: item.note ?? '',
                                })}
                              >
                                Edit
                              </Button>
                              <Button type="button" size="sm" variant="secondary" onClick={() => void removeTrip(item.id)} disabled={saving} aria-label="Delete trip">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function formatTripDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return iso;
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function purposeLabel(purpose: TripPurpose): string {
  return PURPOSES.find((item) => item.value === purpose)?.label ?? purpose;
}

function actualDetail(actual: ActualVehicleCost | null, windowLabel: string): string {
  if (!actual) return 'Save a vehicle, then tag its gas and insurance on Expenses.';
  if (actual.expenseCents <= 0) return 'No fuel, insurance, repairs, or other vehicle expenses are tagged to this vehicle yet.';
  const spent = `${money(actual.expenseCents)} tagged${windowLabel ? ` (${windowLabel})` : ''}.`;
  if (actual.milesSource === 'trips') return `${spent} Split across ${actual.loggedMiles.toLocaleString()} miles logged in that period.`;
  if (actual.milesSource === 'yearly' && actual.miles != null) return `${spent} No trips in that period, so this uses the ${actual.miles.toLocaleString()} yearly miles.`;
  return `${spent} Enter yearly miles or log a trip to get a cost per mile.`;
}

function CostPanel({
  title,
  detail,
  perMile,
  tripCents,
  gasPerMile,
  otherPerMile,
  gallons,
  gasTrip,
  expenseCents,
}: {
  title: string;
  detail: string;
  perMile: number | null;
  tripCents: number | null;
  gasPerMile: number | null;
  otherPerMile: number | null;
  gallons: number | null;
  gasTrip: number | null;
  expenseCents?: number | null;
}) {
  return (
    <section className="rounded-lg border-2 border-black bg-white p-4">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      <p className="mt-1 text-xs text-gray-500">{detail}</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Stat label="Cost per mile" value={perMile == null ? '—' : `${money(perMile, 3)}`} />
        <Stat label="Average trip" value={money(tripCents)} />
        {expenseCents != null && <Stat label="Expenses in period" value={money(expenseCents)} />}
        {gasPerMile != null && <Stat label="Gas per mile" value={money(gasPerMile, 3)} />}
        {otherPerMile != null && <Stat label="Other costs per mile" value={money(otherPerMile, 3)} />}
        {gallons != null && <Stat label="Gallons on an average trip" value={gallons.toFixed(2)} />}
        {gasTrip != null && <Stat label="Gas on that trip" value={money(Math.round(gasTrip))} />}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-gray-200 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 font-semibold text-gray-900">{value}</p>
    </div>
  );
}
