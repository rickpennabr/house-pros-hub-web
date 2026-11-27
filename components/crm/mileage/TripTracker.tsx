'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, MapPin, Navigation, Pause, Play, Plus, Square, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PickerSelect } from '@/components/ui/PickerSelect';
import { cleanPoints, routeMiles, type TrackPoint } from '@/lib/crm/trip-track';

/**
 * Live trip: pick the trip type and customer, Start, drive, Stop. The phone's GPS follows the route
 * while the Hub stays open (a browser cannot read GPS with the screen off); the screen is kept
 * awake. Points are saved to the server every 30 seconds so a refresh never loses the trip.
 */

interface Option {
  id: string;
  name: string;
}

interface LiveRow {
  vehicle_id: string | null;
  trip_type_id: string | null;
  customer_id: string | null;
  started_at: string;
  points: TrackPoint[] | null;
}

interface Saved {
  id: string;
  miles: number;
  amountCents: number;
  minutes: number;
  from: string | null;
  to: string | null;
  hasRoute: boolean;
}

const LAST_VEHICLE_KEY = 'hub.trip.vehicle';
const FLUSH_MS = 30_000;
const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

function localDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function elapsed(fromIso: string, now: number): string {
  const total = Math.max(0, Math.floor((now - new Date(fromIso).getTime()) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

export function TripTracker({
  autoOpen = false,
  vehicles,
  customers,
  costPerMileCents,
  onSaved,
}: {
  /** Opened from the Add menu (ProTrips): go straight to picking the trip. */
  autoOpen?: boolean;
  vehicles: Option[];
  customers: Option[];
  /** The vehicle's cost per mile, for the running cost (cents). */
  costPerMileCents: (vehicleId: string) => number | null;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [types, setTypes] = useState<Option[]>([]);
  const [typeId, setTypeId] = useState('');
  const [newType, setNewType] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [live, setLive] = useState<LiveRow | null>(null);
  const [paused, setPaused] = useState(false);
  const [points, setPoints] = useState<TrackPoint[]>([]);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [milesOverride, setMilesOverride] = useState('');
  const [note, setNote] = useState('');
  const [stopping, setStopping] = useState(false);

  const pending = useRef<TrackPoint[]>([]);
  const watchId = useRef<number | null>(null);
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null);

  // A trip already in progress (refresh, crash, another tab): offer to continue it.
  useEffect(() => {
    let cancelled = false;
    void fetch('/api/crm/mileage/live', { credentials: 'include' })
      .then((res) => res.json())
      .then((body: { live?: LiveRow | null }) => {
        if (cancelled || !body.live) return;
        setLive(body.live);
        setPoints(Array.isArray(body.live.points) ? body.live.points : []);
        setPaused(true);
        setOpen(true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const loadTypes = useCallback(async () => {
    const res = await fetch('/api/crm/mileage/trip-types', { credentials: 'include' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Could not load trip types');
    setTypes(((body.types ?? []) as Array<{ id: string; label: string }>).map((t) => ({ id: t.id, name: t.label })));
  }, []);

  const openSetup = () => {
    setOpen(true);
    setSaved(null);
    setError(null);
    let last = '';
    try {
      last = localStorage.getItem(LAST_VEHICLE_KEY) ?? '';
    } catch {
      /* private mode */
    }
    setVehicleId(vehicles.some((v) => v.id === last) ? last : vehicles[0]?.id ?? '');
    loadTypes().catch((e) => setError(e instanceof Error ? e.message : 'Could not load trip types'));
  };

  const addType = async () => {
    const label = (newType ?? '').trim();
    if (!label) return;
    setBusy(true);
    try {
      const res = await fetch('/api/crm/mileage/trip-types', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Could not add the type');
      await loadTypes();
      setTypeId(body.type.id);
      setNewType(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add the type');
    } finally {
      setBusy(false);
    }
  };

  const flush = useCallback(async () => {
    if (pending.current.length === 0) return;
    const batch = pending.current;
    pending.current = [];
    const res = await fetch('/api/crm/mileage/live', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points: batch }),
    }).catch(() => null);
    if (!res || !res.ok) pending.current = [...batch, ...pending.current]; // try again next time
  }, []);

  const stopWatching = useCallback(() => {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    void wakeLock.current?.release().catch(() => undefined);
    wakeLock.current = null;
  }, []);

  const startWatching = useCallback(async () => {
    if (!('geolocation' in navigator)) {
      setError('This phone does not share its location with the browser.');
      return;
    }
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } };
      wakeLock.current = (await nav.wakeLock?.request('screen')) ?? null;
    } catch {
      /* not supported: the banner asks to keep the screen on */
    }
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const point: TrackPoint = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          t: pos.timestamp || Date.now(),
          acc: Math.round(pos.coords.accuracy),
        };
        setAccuracy(point.acc ?? null);
        pending.current.push(point);
        setPoints((prev) => [...prev, point]);
      },
      (err) => {
        setError(err.code === err.PERMISSION_DENIED ? 'Allow location for the Hub to track the trip (browser settings → Location).' : 'Looking for GPS…');
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 }
    );
  }, []);

  // While driving: clock, save points every 30 s, and keep the screen awake again after it comes back.
  useEffect(() => {
    if (!live || paused) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const save = setInterval(() => void flush(), FLUSH_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !wakeLock.current) {
        const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } };
        void nav.wakeLock?.request('screen').then((lock) => (wakeLock.current = lock)).catch(() => undefined);
      }
      if (document.visibilityState === 'hidden') void flush();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(tick);
      clearInterval(save);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [live, paused, flush]);

  useEffect(() => () => stopWatching(), [stopWatching]);

  // ProTrips from the Add menu: open the trip setup right away (unless a trip is in progress).
  const autoOpened = useRef(false);
  useEffect(() => {
    if (!autoOpen || autoOpened.current) return;
    autoOpened.current = true;
    const id = setTimeout(() => {
      if (!live) openSetup();
    }, 400);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, after the in-progress check
  }, [autoOpen]);

  const start = async () => {
    if (!vehicleId) {
      setError('Add a vehicle first (Add vehicle, above).');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/crm/mileage/live', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicleId, tripTypeId: typeId || null, customerId: customerId || null }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Could not start the trip');
      try {
        localStorage.setItem(LAST_VEHICLE_KEY, vehicleId);
      } catch {
        /* private mode */
      }
      setPoints([]);
      pending.current = [];
      setLive(body.live);
      setPaused(false);
      setNow(Date.now());
      await startWatching();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the trip');
    } finally {
      setBusy(false);
    }
  };

  const pause = async () => {
    stopWatching();
    await flush();
    setPaused(true);
  };

  const resume = async () => {
    setPaused(false);
    setNow(Date.now());
    await startWatching();
  };

  const cancel = async () => {
    stopWatching();
    pending.current = [];
    await fetch('/api/crm/mileage/live', { method: 'DELETE', credentials: 'include' }).catch(() => undefined);
    setLive(null);
    setPoints([]);
    setStopping(false);
    setOpen(false);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    stopWatching();
    try {
      const typed = Number(milesOverride);
      const res = await fetch('/api/crm/mileage/live/stop', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          points: pending.current,
          tripDate: localDate(),
          note: note.trim() || null,
          ...(milesOverride.trim() && typed > 0 ? { miles: typed } : {}),
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        if (typeof body.measured === 'number') setMilesOverride(body.measured > 0 ? String(body.measured) : '');
        throw new Error(body.error || 'Could not save the trip');
      }
      pending.current = [];
      setSaved(body as Saved);
      setLive(null);
      setPoints([]);
      setStopping(false);
      setMilesOverride('');
      setNote('');
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the trip');
    } finally {
      setBusy(false);
    }
  };

  const cleaned = cleanPoints(points);
  const miles = routeMiles(cleaned);
  const rate = live?.vehicle_id ? costPerMileCents(live.vehicle_id) : null;
  const gps = accuracy == null ? 'Waiting for GPS' : accuracy <= 20 ? 'GPS strong' : accuracy <= 50 ? 'GPS fair' : 'GPS weak';

  if (!open) {
    return (
      <button
        type="button"
        onClick={openSetup}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-black px-4 py-4 text-base font-semibold text-white hover:bg-gray-800"
      >
        <Navigation className="h-5 w-5" aria-hidden /> Start a ProTrip
      </button>
    );
  }

  return (
    <section className="rounded-lg border-2 border-black bg-white p-4" aria-live="polite">
      {error ? <p className="mb-3 rounded-lg border-2 border-red-600 p-2 text-sm text-red-700">{error}</p> : null}

      {saved ? (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Trip saved</h2>
          {saved.hasRoute ? (
            // eslint-disable-next-line @next/next/no-img-element -- private route image from our own API
            <img src={`/api/crm/mileage/trips/${saved.id}/map?w=600&h=280`} alt="Route of the trip" className="w-full rounded-lg border border-gray-200" />
          ) : null}
          <p className="text-sm">
            <strong>{saved.miles} mi</strong> · {saved.minutes} min · <strong>{money(saved.amountCents)}</strong>
          </p>
          {saved.from || saved.to ? <p className="text-sm text-gray-600">{[saved.from, saved.to].filter(Boolean).join(' → ')}</p> : null}
          <div className="flex gap-2">
            <Button type="button" onClick={openSetup}>Track another</Button>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Done</Button>
          </div>
        </div>
      ) : live ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">{paused ? 'Trip paused' : 'Trip in progress'}</h2>
            <span className="inline-flex items-center gap-1 text-xs text-gray-600">
              <span className={`h-2 w-2 rounded-full ${paused ? 'bg-gray-400' : accuracy != null && accuracy <= 50 ? 'bg-green-600' : 'bg-amber-500'}`} aria-hidden />
              {paused ? 'Paused' : gps}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg border border-gray-200 p-2">
              <p className="text-xs text-gray-600">Time</p>
              <p className="text-xl font-semibold tabular-nums">{elapsed(live.started_at, now)}</p>
            </div>
            <div className="rounded-lg border border-gray-200 p-2">
              <p className="text-xs text-gray-600">Miles</p>
              <p className="text-xl font-semibold tabular-nums">{miles.toFixed(1)}</p>
            </div>
            <div className="rounded-lg border border-gray-200 p-2">
              <p className="text-xs text-gray-600">Cost</p>
              <p className="text-xl font-semibold tabular-nums">{rate != null ? money(Math.round(miles * rate)) : '—'}</p>
            </div>
          </div>
          {!paused ? (
            <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
              Keep the Hub open while you drive. Phones stop sharing location when the screen locks or another app opens.
            </p>
          ) : null}

          {stopping ? (
            <div className="space-y-2">
              <label className="block text-sm">
                Miles (leave empty to use the GPS: {miles.toFixed(1)})
                <Input inputMode="decimal" value={milesOverride} onChange={(e) => setMilesOverride(e.target.value)} placeholder={miles.toFixed(1)} className="mt-1" />
              </label>
              <label className="block text-sm">
                Note (optional)
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Picked up tile on the way" className="mt-1" />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => void save()} disabled={busy}>
                  {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden /> : null} Save trip
                </Button>
                <Button type="button" variant="secondary" onClick={() => setStopping(false)} disabled={busy}>Back</Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {paused ? (
                <Button type="button" variant="secondary" onClick={() => void resume()}>
                  <Play className="mr-1 h-4 w-4" aria-hidden /> {points.length ? 'Continue' : 'Start GPS'}
                </Button>
              ) : (
                <Button type="button" variant="secondary" onClick={() => void pause()}>
                  <Pause className="mr-1 h-4 w-4" aria-hidden /> Pause
                </Button>
              )}
              <Button
                type="button"
                onClick={() => {
                  stopWatching();
                  void flush();
                  setPaused(true);
                  setStopping(true);
                }}
              >
                <Square className="mr-1 h-4 w-4" aria-hidden /> Stop
              </Button>
              <Button type="button" variant="secondary" onClick={() => void cancel()}>
                <X className="mr-1 h-4 w-4" aria-hidden /> Cancel
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">New ProTrip</h2>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1 hover:bg-gray-100" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Trip type</p>
            <div className="flex flex-wrap gap-2">
              {types.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setTypeId(type.id === typeId ? '' : type.id)}
                  aria-pressed={type.id === typeId}
                  className={`rounded-lg border-2 border-black px-3 py-1.5 text-sm ${type.id === typeId ? 'bg-black text-white' : 'bg-white hover:bg-gray-100'}`}
                >
                  {type.name}
                </button>
              ))}
              {newType === null ? (
                <button type="button" onClick={() => setNewType('')} className="inline-flex items-center gap-1 rounded-lg border-2 border-dashed border-gray-400 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                  <Plus className="h-4 w-4" aria-hidden /> New type
                </button>
              ) : (
                <span className="flex w-full gap-2">
                  <Input value={newType} onChange={(e) => setNewType(e.target.value.slice(0, 40))} placeholder="e.g. Permit office" autoFocus />
                  <Button type="button" size="sm" onClick={() => void addType()} disabled={busy || !newType.trim()}>Add</Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => setNewType(null)}>Cancel</Button>
                </span>
              )}
            </div>
          </div>
          <label className="block text-sm font-medium">
            Related to (customer, supplier or other contact)
            <div className="mt-1">
              <PickerSelect
                value={customerId}
                onChange={setCustomerId}
                noneLabel="Nobody (not related to a contact)"
                placeholder="Pick a contact"
                options={customers.map((c) => ({ value: c.id, label: c.name }))}
              />
            </div>
          </label>
          <label className="block text-sm font-medium">
            Vehicle
            <div className="mt-1">
              <PickerSelect value={vehicleId} onChange={setVehicleId} placeholder="Pick a vehicle" options={vehicles.map((v) => ({ value: v.id, label: v.name }))} />
            </div>
          </label>
          <Button type="button" onClick={() => void start()} disabled={busy || !vehicleId} className="w-full">
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden /> : <MapPin className="mr-1 h-4 w-4" aria-hidden />} Start
          </Button>
        </div>
      )}
    </section>
  );
}
