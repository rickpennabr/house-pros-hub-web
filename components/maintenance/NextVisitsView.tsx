'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, List, Map as MapIcon, Play } from 'lucide-react';
import { AdminDataTable, type AdminDataTableColumn } from '@/components/admin/AdminDataTable';
import { AddressPinsMap } from '@/components/maps/AddressPinsMap';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { isMaintenanceFrequency, MAINTENANCE_FREQUENCY_LABELS } from '@/lib/crm/estimate-agreement';

/** The fields of GET /api/crm/maintenance/houses this view uses. */
interface HouseRow {
  id: string;
  customerId: string;
  customerName: string;
  placeName: string | null;
  address: string;
  phone: string | null;
  status: 'overdue' | 'due_soon' | 'scheduled' | 'ended';
  planName: string;
  frequency: string;
  planCents: number | null;
  nextVisitDate: string | null;
  endDate?: string | null;
  openVisitId: string | null;
}

/** One planned visit: a house on a date. */
interface PlannedVisit {
  id: string;
  date: string;
  overdue: boolean;
  house: HouseRow;
}

type View = 'schedule' | 'table' | 'map';
const HORIZONS = [7, 14, 30, 60] as const;
const HOUSE_CAP = 100;

function todayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(key: string, days: number): string {
  const date = parseKey(key);
  date.setUTCDate(date.getUTCDate() + days);
  return toKey(date);
}

/** Same day of month, clamped to the month's last day (Jan 31 + 1 month = Feb 28). */
function addMonths(key: string, months: number): string {
  const date = parseKey(key);
  const day = date.getUTCDate();
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, last));
  return toKey(target);
}

function nextOccurrence(key: string, frequency: string): string | null {
  switch (frequency) {
    case 'weekly':
      return addDays(key, 7);
    case 'biweekly':
      return addDays(key, 14);
    case 'monthly':
      return addMonths(key, 1);
    case 'quarterly':
      return addMonths(key, 3);
    case 'yearly':
      return addMonths(key, 12);
    default:
      return null;
  }
}

/**
 * Visits from each house's next visit date, repeated by its schedule up to the horizon and the
 * agreement's end date. A next visit already in the past shows once, as overdue.
 */
function planVisits(houses: HouseRow[], today: string, horizonDays: number): PlannedVisit[] {
  const until = addDays(today, horizonDays);
  const visits: PlannedVisit[] = [];
  for (const house of houses) {
    if (house.status === 'ended' || !house.nextVisitDate) continue;
    let date: string | null = house.nextVisitDate;
    if (date < today) {
      visits.push({ id: `${house.id}:${date}`, date, overdue: true, house });
      continue;
    }
    let guard = 0;
    while (date && date <= until && (!house.endDate || date <= house.endDate) && guard < 60) {
      visits.push({ id: `${house.id}:${date}`, date, overdue: false, house });
      date = nextOccurrence(date, house.frequency);
      guard += 1;
    }
  }
  return visits.sort((a, b) => a.date.localeCompare(b.date) || a.house.customerName.localeCompare(b.house.customerName));
}

function dayHeading(date: string, today: string): string {
  if (date === today) return 'Today';
  if (date === addDays(today, 1)) return 'Tomorrow';
  return parseKey(date).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function shortDate(date: string): string {
  return parseKey(date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

const money = (cents: number | null) =>
  cents == null ? '' : (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

const frequencyLabel = (frequency: string) =>
  isMaintenanceFrequency(frequency) ? MAINTENANCE_FREQUENCY_LABELS[frequency] : frequency;

const houseTitle = (house: HouseRow) => (house.placeName ? `${house.customerName} · ${house.placeName}` : house.customerName);

const COLUMNS: AdminDataTableColumn<PlannedVisit>[] = [
  { id: 'date', label: 'Date', width: 150 },
  { id: 'house', label: 'House', sortKey: 'house', width: 220 },
  { id: 'address', label: 'Address', sortKey: 'address', width: 260 },
  { id: 'agreement', label: 'Agreement', sortKey: 'agreement', width: 220 },
  { id: 'frequency', label: 'Schedule', sortKey: 'frequency', width: 140 },
  { id: 'price', label: 'Price', sortKey: 'price', width: 110 },
  { id: 'actions', label: 'Actions', resizable: false },
];

function cellText(row: PlannedVisit, columnId: string): string {
  switch (columnId) {
    case 'date':
      return row.overdue ? `${shortDate(row.date)} (overdue)` : shortDate(row.date);
    case 'house':
      return houseTitle(row.house);
    case 'address':
      return row.house.address;
    case 'agreement':
      return row.house.planName;
    case 'frequency':
      return frequencyLabel(row.house.frequency);
    case 'price':
      return money(row.house.planCents);
    default:
      return '';
  }
}

interface NextVisitsViewProps {
  onOpenHouse: (houseId: string) => void;
  /** Start (or resume) the visit at this house in the Visits tab. */
  onStartVisit: (house: { customerId: string; planId: string }) => void;
}

/** Upcoming maintenance visits from each agreement's schedule: by day, as a table, or on a map. */
export function NextVisitsView({ onOpenHouse, onStartVisit }: NextVisitsViewProps) {
  const [houses, setHouses] = useState<HouseRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedView, setSavedView] = useLocalStorage<string>('crmMaintenanceNextVisitsView', 'schedule');
  const view: View = savedView === 'table' || savedView === 'map' ? savedView : 'schedule';
  const [savedHorizon, setSavedHorizon] = useLocalStorage<number>('crmMaintenanceNextVisitsDays', 14);
  const horizon = (HORIZONS as readonly number[]).includes(savedHorizon) ? savedHorizon : 14;
  const today = todayKey();

  useEffect(() => {
    let cancelled = false;
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const query = new URLSearchParams({
      pageSize: String(HOUSE_CAP),
      sortBy: 'next_visit',
      sortDir: 'asc',
      timeZone,
    });
    fetch(`/api/crm/maintenance/houses?${query}`, { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Could not load the schedule');
        if (!cancelled) setHouses(Array.isArray(data.houses) ? data.houses : []);
      })
      .catch((err) => {
        if (!cancelled) {
          setHouses([]);
          setError(err instanceof Error ? err.message : 'Could not load the schedule');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visits = useMemo(() => planVisits(houses ?? [], today, horizon), [houses, today, horizon]);
  const groups = useMemo(() => {
    const byDay = new Map<string, PlannedVisit[]>();
    for (const visit of visits) {
      const key = visit.overdue ? 'overdue' : visit.date;
      byDay.set(key, [...(byDay.get(key) ?? []), visit]);
    }
    return [...byDay.entries()];
  }, [visits]);

  const pill = (active: boolean) =>
    `inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border-2 border-black px-3 text-sm font-medium cursor-pointer ${
      active ? 'bg-black text-white' : 'bg-white text-black hover:bg-gray-50'
    }`;

  const startButton = (house: HouseRow) => (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onStartVisit({ customerId: house.customerId, planId: house.id });
      }}
      className="inline-flex shrink-0 items-center gap-1 rounded-lg border-2 border-black px-2 py-1 text-xs font-medium hover:bg-gray-50 cursor-pointer"
    >
      <Play className="h-3.5 w-3.5" />
      {house.openVisitId ? 'Resume' : 'Start'}
    </button>
  );

  return (
    <div className="w-full space-y-4 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="View">
          <button type="button" className={pill(view === 'schedule')} onClick={() => setSavedView('schedule')}>
            <CalendarDays className="h-4 w-4" /> Schedule
          </button>
          <button type="button" className={pill(view === 'table')} onClick={() => setSavedView('table')}>
            <List className="h-4 w-4" /> Table
          </button>
          <button type="button" className={pill(view === 'map')} onClick={() => setSavedView('map')}>
            <MapIcon className="h-4 w-4" /> Map
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="How far ahead">
          {HORIZONS.map((days) => (
            <button key={days} type="button" className={pill(horizon === days)} onClick={() => setSavedHorizon(days)}>
              {days} days
            </button>
          ))}
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {houses !== null && houses.length >= HOUSE_CAP ? (
        <p className="text-xs text-gray-500">Showing the first {HOUSE_CAP} houses by next visit.</p>
      ) : null}

      {houses === null ? (
        <p className="py-12 text-center text-sm text-gray-500">Loading the schedule…</p>
      ) : visits.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-500">
          No visits in the next {horizon} days. Houses need a next visit date on their agreement.
        </p>
      ) : view === 'schedule' ? (
        <div className="space-y-4">
          {groups.map(([key, dayVisits]) => (
            <section key={key} className="space-y-2">
              <h3 className={`text-sm font-semibold ${key === 'overdue' ? 'text-red-600' : 'text-gray-900'}`}>
                {key === 'overdue' ? 'Overdue' : dayHeading(key, today)}
                <span className="ml-2 font-normal text-gray-500">· {dayVisits.length}</span>
              </h3>
              <ul className="space-y-2">
                {dayVisits.map((visit) => (
                  <li
                    key={visit.id}
                    className={`flex items-center gap-3 rounded-lg border-2 px-3 py-2 ${
                      visit.overdue ? 'border-red-600' : 'border-black'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onOpenHouse(visit.house.id)}
                      className="min-w-0 flex-1 cursor-pointer text-left"
                    >
                      <span className="block truncate font-medium">{houseTitle(visit.house)}</span>
                      <span className="block truncate text-xs text-gray-600">
                        {[
                          visit.overdue ? `Due ${shortDate(visit.date)}` : null,
                          visit.house.address,
                          visit.house.planName,
                          frequencyLabel(visit.house.frequency),
                          money(visit.house.planCents),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </button>
                    {visit.house.phone ? (
                      <a href={`tel:${visit.house.phone}`} className="hidden text-sm underline sm:inline">
                        Call
                      </a>
                    ) : null}
                    {startButton(visit.house)}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : view === 'table' ? (
        <AdminDataTable
          clientSide
          hideSearch
          columnOrderKey="crm-maintenance-next-visits"
          exportName="next-visits"
          columns={COLUMNS}
          data={visits}
          total={visits.length}
          isLoading={false}
          hasLoadedOnce
          error={null}
          getRowId={(row) => row.id}
          getCellText={cellText}
          renderCell={(row, columnId) => {
            const text = cellText(row, columnId);
            if (columnId === 'date' && row.overdue) return <span className="font-medium text-red-600">{text}</span>;
            return text || '—';
          }}
          onRowClick={(row) => onOpenHouse(row.house.id)}
          renderActions={(row) => startButton(row.house)}
          emptyMessage="No visits planned."
          itemLabel="visits"
          primaryColumnId="house"
        />
      ) : (
        <AddressPinsMap
          pins={[...new Map(visits.map((visit) => [visit.house.id, visit])).values()].map((visit) => ({
            id: visit.house.id,
            title: houseTitle(visit.house),
            detail: visit.overdue ? `Overdue · was due ${shortDate(visit.date)}` : `Next ${shortDate(visit.date)}`,
            address: visit.house.address,
          }))}
          onOpen={onOpenHouse}
        />
      )}
    </div>
  );
}
