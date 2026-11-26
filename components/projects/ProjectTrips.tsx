'use client';

import { useCallback, useEffect, useState } from 'react';
import { Car, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { PickerSelect } from '@/components/ui/PickerSelect';

interface Trip {
  id: string;
  tripDate: string;
  purpose: string;
  vehicleName: string;
  origin: string | null;
  destination: string | null;
  miles: number;
  amountCents: number;
  note: string | null;
  by: string | null;
}

interface Vehicle {
  id: string;
  name: string;
  costPerMileCents: number | null;
}

const PURPOSES = [
  { value: 'job', label: 'Job' },
  { value: 'supply_run', label: 'Supply run' },
  { value: 'other', label: 'Other' },
];
const PURPOSE_LABEL: Record<string, string> = { job: 'Job', supply_run: 'Supply run', other: 'Other', estimate: 'Estimate visit' };

const money = (cents: number) => new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(cents / 100);
const shortDate = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

function TripList({ trips, empty }: { trips: Trip[]; empty: string }) {
  if (trips.length === 0) return <p className="text-sm text-gray-600">{empty}</p>;
  return (
    <ul className="divide-y divide-gray-200 rounded-lg border-2 border-black bg-white">
      {trips.map((trip) => (
        <li key={trip.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
          <span className="min-w-0">
            <span className="font-medium">{shortDate(trip.tripDate)}</span> · {PURPOSE_LABEL[trip.purpose] ?? trip.purpose} · {trip.vehicleName}
            <span className="block text-xs text-gray-600">
              {[trip.origin && trip.destination ? `${trip.origin} → ${trip.destination}` : trip.destination || trip.origin, trip.note, trip.by ? `logged by ${trip.by}` : null]
                .filter(Boolean)
                .join(' · ') || '—'}
            </span>
          </span>
          <span className="text-right tabular-nums">
            <span className="block font-medium">{money(trip.amountCents)}</span>
            <span className="text-xs text-gray-600">{trip.miles} mi</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Trips for a project. Project trips (job, supply runs) are direct project cost.
 * Estimate visits are shown apart: they are a cost of selling, counted in company costs, not in this project.
 */
export function ProjectTrips({ projectId, onCount }: { projectId: string; onCount?: (count: number) => void }) {
  const [projectTrips, setProjectTrips] = useState<Trip[]>([]);
  const [estimateTrips, setEstimateTrips] = useState<Trip[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [vehicleId, setVehicleId] = useState('');
  const [tripDate, setTripDate] = useState(new Date().toISOString().slice(0, 10));
  const [purpose, setPurpose] = useState('job');
  const [miles, setMiles] = useState('');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/crm/projects/${projectId}/trips`, { credentials: 'include', cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load trips');
      setProjectTrips(data.projectTrips ?? []);
      setEstimateTrips(data.estimateTrips ?? []);
      const list: Vehicle[] = data.vehicles ?? [];
      setVehicles(list);
      setVehicleId((current) => current || list.find((item) => item.costPerMileCents != null)?.id || '');
      onCount?.((data.projectTrips ?? []).length + (data.estimateTrips ?? []).length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load trips');
    } finally {
      setLoading(false);
    }
  }, [projectId, onCount]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/crm/projects/${projectId}/trips`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicleId, tripDate, purpose, miles, origin, destination, note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save the trip');
      setMiles('');
      setNote('');
      setFormOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the trip');
    } finally {
      setBusy(false);
    }
  };

  const projectTotal = projectTrips.reduce((sum, trip) => sum + trip.amountCents, 0);
  const estimateTotal = estimateTrips.reduce((sum, trip) => sum + trip.amountCents, 0);
  const projectMiles = projectTrips.reduce((sum, trip) => sum + trip.miles, 0);
  const selected = vehicles.find((item) => item.id === vehicleId);
  const preview = selected?.costPerMileCents != null && Number(miles) > 0 ? Math.round(Number(miles) * selected.costPerMileCents) : null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-lg border-2 border-black p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-600">Project trips · project cost</p>
          <p className="text-2xl font-bold tabular-nums">{money(projectTotal)}</p>
          <p className="text-xs text-gray-600">
            {projectTrips.length} trip{projectTrips.length === 1 ? '' : 's'} · {Math.round(projectMiles * 10) / 10} mi
          </p>
        </div>
        <div className="rounded-lg border-2 border-gray-300 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-600">Estimate trips · cost of selling</p>
          <p className="text-2xl font-bold tabular-nums">{money(estimateTotal)}</p>
          <p className="text-xs text-gray-600">In company costs, not in this project&apos;s profit.</p>
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-bold">Project trips</h3>
          <Button type="button" size="sm" onClick={() => setFormOpen((value) => !value)}>
            <Plus className="mr-1 h-4 w-4" /> Log trip
          </Button>
        </div>
        {formOpen ? (
          <div className="space-y-2 rounded-lg border-2 border-black p-3">
            {vehicles.length === 0 ? (
              <p className="text-sm text-gray-700">Add a vehicle on the Mileage page first, so a trip has a cost per mile.</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                  <label className="col-span-2 text-xs font-medium md:col-span-1">
                    Vehicle
                    <PickerSelect
                      value={vehicleId}
                      onChange={(value) => setVehicleId(value)}
                      options={vehicles.map((vehicle) => ({ value: String(vehicle.id), label: `${vehicle.name}${vehicle.costPerMileCents == null ? ' (no rate yet)' : ` · ${money(vehicle.costPerMileCents)}/mi`}` }))}
                    />
                  </label>
                  <label className="text-xs font-medium">
                    Date
                    <Input type="date" value={tripDate} onChange={(e) => setTripDate(e.target.value)} className="mt-1" />
                  </label>
                  <label className="text-xs font-medium">
                    Why
                    <Select value={purpose} onChange={(e) => setPurpose(e.target.value)} className="mt-1">
                      {PURPOSES.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label className="text-xs font-medium">
                    Miles (round trip)
                    <Input value={miles} onChange={(e) => setMiles(e.target.value)} inputMode="decimal" placeholder="e.g. 30" className="mt-1" />
                  </label>
                  <label className="col-span-2 text-xs font-medium md:col-span-1">
                    From
                    <Input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="Office, yard…" className="mt-1" />
                  </label>
                  <label className="col-span-2 text-xs font-medium md:col-span-1">
                    To
                    <Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Jobsite, supplier…" className="mt-1" />
                  </label>
                  <label className="col-span-2 text-xs font-medium">
                    Note
                    <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" className="mt-1" />
                  </label>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-gray-700">{preview != null ? `This trip costs ${money(preview)}.` : 'Office → jobsite → office counts as one round trip.'}</p>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="secondary" onClick={() => setFormOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="button" size="sm" onClick={() => void save()} disabled={busy || !vehicleId || !miles}>
                      <Car className="mr-1 h-4 w-4" /> Save trip
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : null}
        {loading ? <p className="text-sm text-gray-500">Loading trips…</p> : <TripList trips={projectTrips} empty="No project trips yet. Crew and office can log them here." />}
      </section>

      <section className="space-y-2">
        <h3 className="font-bold">Estimate trips</h3>
        <p className="text-xs text-gray-600">Visits to measure and give the estimate, logged on the Mileage page with the estimate. They count as a cost of selling.</p>
        {loading ? null : <TripList trips={estimateTrips} empty="No estimate trips for this job." />}
      </section>
    </div>
  );
}
