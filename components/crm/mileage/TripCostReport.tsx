'use client';

import { useEffect, useMemo, useState } from 'react';
import { Select } from '@/components/ui/Select';

/**
 * ProTrips report: what driving costs, by trip type or by contact, for a period.
 * Built from the trips already on the page plus the pro's trip types.
 */

interface ReportTrip {
  tripDate: string;
  miles: number;
  amountCents: number;
  purpose: string;
  customerId: string | null;
  tripTypeId?: string | null;
}

const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const PURPOSE: Record<string, string> = { job: 'Job', estimate: 'Estimate', supply_run: 'Supply run', other: 'Other' };

function periodStart(period: string, today: Date): string {
  const y = today.getFullYear();
  const m = today.getMonth();
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  if (period === 'month') return iso(new Date(y, m, 1));
  if (period === 'quarter') return iso(new Date(y, Math.floor(m / 3) * 3, 1));
  if (period === '30') return iso(new Date(y, m, today.getDate() - 30));
  return `${y}-01-01`;
}

export function TripCostReport({ trips, customers }: { trips: ReportTrip[]; customers: Array<{ id: string; name: string }> }) {
  const [groupBy, setGroupBy] = useState<'type' | 'contact'>('type');
  const [period, setPeriod] = useState('year');
  const [types, setTypes] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let cancelled = false;
    void fetch('/api/crm/mileage/trip-types', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : { types: [] }))
      .then((body: { types?: Array<{ id: string; label: string }> }) => {
        if (!cancelled) setTypes(new Map((body.types ?? []).map((t) => [t.id, t.label])));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo(() => {
    const from = periodStart(period, new Date());
    const names = new Map(customers.map((c) => [c.id, c.name]));
    const groups = new Map<string, { trips: number; miles: number; cents: number }>();
    for (const trip of trips) {
      if (trip.tripDate < from) continue;
      const key =
        groupBy === 'contact'
          ? (trip.customerId && names.get(trip.customerId)) || 'Not related to a contact'
          : (trip.tripTypeId && types.get(trip.tripTypeId)) || PURPOSE[trip.purpose] || 'Other';
      const g = groups.get(key) ?? { trips: 0, miles: 0, cents: 0 };
      g.trips += 1;
      g.miles += trip.miles;
      g.cents += trip.amountCents;
      groups.set(key, g);
    }
    return [...groups.entries()].map(([name, g]) => ({ name, ...g })).sort((a, b) => b.cents - a.cents);
  }, [trips, customers, types, groupBy, period]);

  const total = rows.reduce((sum, r) => ({ trips: sum.trips + r.trips, miles: sum.miles + r.miles, cents: sum.cents + r.cents }), { trips: 0, miles: 0, cents: 0 });
  const top = rows[0]?.cents || 1;

  return (
    <section className="rounded-lg border-2 border-black bg-white p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Trip costs</h2>
          <p className="text-xs text-gray-500">
            {total.trips} trips · {Math.round(total.miles * 10) / 10} mi · {money(total.cents)}
          </p>
        </div>
        <div className="flex gap-2">
          <div className="w-40">
            <Select value={groupBy} onChange={(e) => setGroupBy(e.target.value as 'type' | 'contact')} aria-label="Group by">
              <option value="type">By trip type</option>
              <option value="contact">By contact</option>
            </Select>
          </div>
          <div className="w-36">
            <Select value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Period">
              <option value="30">Last 30 days</option>
              <option value="month">This month</option>
              <option value="quarter">This quarter</option>
              <option value="year">This year</option>
            </Select>
          </div>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">No trips in this period yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map((row) => (
            <li key={row.name} className="text-sm">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">{row.name}</span>
                <span>
                  <strong>{money(row.cents)}</strong>
                  <span className="ml-2 text-xs text-gray-500">
                    {row.trips} trips · {Math.round(row.miles * 10) / 10} mi · {money(Math.round(row.cents / row.trips))} each
                  </span>
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100" aria-hidden>
                <div className="h-full rounded-full bg-red-600" style={{ width: `${Math.max(3, (row.cents / top) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
