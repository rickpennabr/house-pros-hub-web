'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { todayDateKey } from '@/lib/crm/invoice-books';

interface Aging {
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  days90plus: number;
}

interface Report {
  from: string;
  to: string;
  outstandingCents: number;
  aging: Aging;
  salesByCustomer: { customerId: string; name: string; totalCents: number }[];
  cash: { collectedCents: number; expenseCents: number; resultCents: number };
}

const money = (cents: number) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(cents / 100);

const buckets: { key: keyof Aging; label: string }[] = [
  { key: 'current', label: 'Current' },
  { key: 'days1to30', label: '1–30 days' },
  { key: 'days31to60', label: '31–60 days' },
  { key: 'days61to90', label: '61–90 days' },
  { key: 'days90plus', label: 'Over 90 days' },
];

export default function CRMReportsPage() {
  const locale = useLocale();
  const today = todayDateKey();
  const [from, setFrom] = useState(`${today.slice(0, 4)}-01-01`);
  const [to, setTo] = useState(today);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (fromDate: string, toDate: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from: fromDate, to: toDate });
      const res = await fetch(`/api/crm/reports?${params}`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load reports');
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(from, to);
    // Initial range only. Later loads go through the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500 mt-0.5">What customers owe, who you billed, and cash minus expenses.</p>
        </div>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            load(from, to);
          }}
        >
          <label className="text-sm text-gray-700">
            From
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1" />
          </label>
          <label className="text-sm text-gray-700">
            To
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1" />
          </label>
          <Button type="submit" size="sm">Apply</Button>
        </form>
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">{error}</div>}
      {loading && !report ? (
        <div className="p-12 text-center text-gray-500 text-sm">Loading reports…</div>
      ) : report && (
        <>
          <section className="rounded-lg border-2 border-black bg-white p-4">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-base font-semibold text-gray-900">Open balances</h2>
              <p className="text-lg font-semibold">{money(report.outstandingCents)}</p>
            </div>
            <p className="text-xs text-gray-500 mt-1">Sent invoices that are not cancelled, as of today. Drafts stay off this report.</p>
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
              {buckets.map((bucket) => (
                <div key={bucket.key} className="rounded-md border border-gray-200 p-3">
                  <p className="text-xs text-gray-500">{bucket.label}</p>
                  <p className="mt-1 font-semibold">{money(report.aging[bucket.key])}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="text-base font-semibold text-gray-900">Sales by customer</h2>
            <p className="text-xs text-gray-500 mt-1">{report.from} to {report.to}</p>
            {report.salesByCustomer.length === 0 ? (
              <p className="mt-4 text-sm text-gray-500">No invoices in this range.</p>
            ) : (
              <ul className="mt-3 divide-y divide-gray-200">
                {report.salesByCustomer.map((row) => (
                  <li key={row.customerId} className="flex justify-between gap-3 py-2 text-sm">
                    <Link href={`/${locale}/crm/customers`} className="text-gray-900 hover:underline">{row.name}</Link>
                    <span className="font-medium">{money(row.totalCents)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="text-base font-semibold text-gray-900">Cash minus expenses</h2>
            <p className="text-xs text-gray-500 mt-1">Payments you recorded, not voided, minus expenses in the same dates.</p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-gray-200 p-3">
                <p className="text-xs text-gray-500">Collected</p>
                <p className="mt-1 text-lg font-semibold">{money(report.cash.collectedCents)}</p>
              </div>
              <div className="rounded-md border border-gray-200 p-3">
                <p className="text-xs text-gray-500">Expenses</p>
                <p className="mt-1 text-lg font-semibold">{money(report.cash.expenseCents)}</p>
              </div>
              <div className="rounded-md border border-gray-200 p-3">
                <p className="text-xs text-gray-500">Result</p>
                <p className="mt-1 text-lg font-semibold">{money(report.cash.resultCents)}</p>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
