'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { COST_BUCKET_LABELS, COST_BUCKETS, type CostBucket } from '@/lib/crm/job-financials';
import type { ProfitAndLoss } from '@/lib/crm/job-financials-db';

const money = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const percent = (value: number | null) => (value == null ? '—' : `${value.toFixed(1)}%`);

type JobFilter = 'all' | 'project' | 'plan';
type JobSort = 'invoiced' | 'profit' | 'margin' | 'cost';

function Row({ label, value, strong, indent }: { label: string; value: string; strong?: boolean; indent?: boolean }) {
  return (
    <div className={`flex justify-between py-1 ${strong ? 'font-semibold' : ''} ${indent ? 'pl-4 text-gray-700' : ''}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

/** Settings that shape job costing: overhead % and the default crew cost per hour. */
function CostingSettings({ initialOverhead, initialRate, onSaved }: { initialOverhead: number; initialRate: number; onSaved: () => void }) {
  const [overhead, setOverhead] = useState(String(initialOverhead || ''));
  const [rate, setRate] = useState(initialRate ? (initialRate / 100).toFixed(2) : '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const overheadPercent = overhead.trim() === '' ? 0 : Number(overhead);
      const res = await fetch('/api/crm/invoice-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          overheadPercent,
          defaultLaborCostCentsPerHour: rate.trim() === '' ? null : Math.round(Number(rate) * 100),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Could not save');
      const saved = body.settings as Record<string, unknown> | null;
      if (saved && !('overhead_percent' in saved)) {
        setMessage('Run database update 167 first, then save again.');
      } else {
        setMessage('Saved.');
        onSaved();
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
      <FormField
        label="Overhead %"
        tip="Added on top of each job's direct costs to cover rent, insurance, phone, software, your truck and the rest. Compare it with the actual % below and adjust."
      >
        <Input type="number" inputMode="decimal" min="0" max="200" step="0.5" value={overhead} onChange={(e) => setOverhead(e.target.value)} placeholder="15" />
      </FormField>
      <FormField
        label="Default crew cost per hour ($)"
        tip="Used for maintenance visit time and for hours logged without a person's own rate."
      >
        <Input type="number" inputMode="decimal" min="0" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="25.00" />
      </FormField>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={() => void save()} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
        {message ? <span className="text-xs text-gray-600">{message}</span> : null}
      </div>
    </div>
  );
}

/**
 * Whole-business profit and loss for a date range: revenue, direct job costs by type, overhead
 * by category, gross and net profit, the real overhead % against the one set, and every job.
 */
export function ProfitAndLossReport({ from, to }: { from: string; to: string }) {
  const locale = useLocale();
  const [report, setReport] = useState<ProfitAndLoss | null>(null);
  const [settings, setSettings] = useState<{ overhead: number; rate: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<JobFilter>('all');
  const [sort, setSort] = useState<JobSort>('invoiced');

  const load = useCallback(() => {
    fetch(`/api/crm/reports/financials?${new URLSearchParams({ from, to })}`, { credentials: 'include' })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || 'Could not load the profit and loss');
        setReport(body as ProfitAndLoss);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load the profit and loss'));
    fetch('/api/crm/invoice-settings', { credentials: 'include' })
      .then((res) => res.json())
      .then((body: { settings?: Record<string, unknown> | null }) => {
        const row = body.settings ?? {};
        setSettings({
          overhead: Number(row.overhead_percent ?? 0) || 0,
          rate: Number(row.default_labor_cost_cents_per_hour ?? 0) || 0,
        });
      })
      .catch(() => setSettings({ overhead: 0, rate: 0 }));
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const jobs = useMemo(() => {
    const list = (report?.jobs ?? []).filter((job) => filter === 'all' || job.kind === filter);
    const value = (job: ProfitAndLoss['jobs'][number]) =>
      sort === 'profit' ? job.netProfitCents : sort === 'margin' ? job.netMarginPercent ?? -Infinity : sort === 'cost' ? job.directCostCents : job.invoicedCents;
    return [...list].sort((a, b) => value(b) - value(a));
  }, [report, filter, sort]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!report) return <p className="py-10 text-center text-sm text-gray-500">Loading profit and loss…</p>;

  const usedBuckets = COST_BUCKETS.filter((bucket) => (report.directCosts[bucket] ?? 0) > 0);
  const overheadGap =
    report.actualOverheadPercent != null && report.setOverheadPercent > 0
      ? report.actualOverheadPercent - report.setOverheadPercent
      : null;

  return (
    <div className="job-report space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-red-600">Profit and loss</p>
          <h2 className="text-lg font-semibold text-gray-900">
            {report.range.from} to {report.range.to}
          </h2>
        </div>
        <Button variant="secondary" size="sm" className="no-print flex items-center gap-2" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'Invoiced', value: money(report.revenue.invoicedCents) },
          { label: 'Collected', value: money(report.revenue.collectedCents) },
          { label: 'Net profit', value: money(report.netProfitCents), tone: report.netProfitCents >= 0 ? 'text-green-700' : 'text-red-600' },
          { label: 'Net margin', value: percent(report.netMarginPercent), tone: (report.netMarginPercent ?? 0) >= 0 ? 'text-green-700' : 'text-red-600' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border-2 border-black bg-white p-3">
            <p className="text-xs uppercase tracking-wide text-gray-600">{stat.label}</p>
            <p className={`mt-1 text-lg font-semibold md:text-xl ${stat.tone ?? 'text-gray-900'}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-lg border-2 border-black bg-white p-4 text-sm">
          <h3 className="mb-2 text-base font-semibold">Statement</h3>
          <Row label="Revenue (invoiced)" value={money(report.revenue.invoicedCents)} strong />
          <p className="mt-2 text-xs font-semibold uppercase text-gray-500">Direct job costs</p>
          {usedBuckets.length === 0 ? <Row label="None" value={money(0)} indent /> : null}
          {usedBuckets.map((bucket) => (
            <Row key={bucket} label={COST_BUCKET_LABELS[bucket as CostBucket]} value={money(report.directCosts[bucket] ?? 0)} indent />
          ))}
          <Row label="Total direct costs" value={`− ${money(report.directCostCents)}`} />
          <div className="border-t border-gray-200">
            <Row label={`Gross profit · ${percent(report.grossMarginPercent)}`} value={money(report.grossProfitCents)} strong />
          </div>
          <p className="mt-2 text-xs font-semibold uppercase text-gray-500">Overhead</p>
          {report.overhead.length === 0 ? <Row label="None recorded" value={money(0)} indent /> : null}
          {report.overhead.map((item) => (
            <Row key={item.category} label={item.category} value={money(item.amountCents)} indent />
          ))}
          <Row label="Total overhead" value={`− ${money(report.overheadCents)}`} />
          <div className="border-t-2 border-black">
            <Row label={`Net profit · ${percent(report.netMarginPercent)}`} value={money(report.netProfitCents)} strong />
          </div>
          {report.unlinkedJobCostCents > 0 ? (
            <p className="mt-2 text-xs text-amber-700">
              {money(report.unlinkedJobCostCents)} of job costs are not linked to a project or house. Link them in Expenses so
              each job&apos;s report is complete.
            </p>
          ) : null}
        </section>

        <section className="rounded-lg border-2 border-black bg-white p-4 text-sm">
          <h3 className="mb-2 text-base font-semibold">Overhead %</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-gray-200 p-3">
              <p className="text-xs text-gray-500">You set</p>
              <p className="text-xl font-semibold">{report.setOverheadPercent}%</p>
            </div>
            <div className="rounded-lg border border-gray-200 p-3">
              <p className="text-xs text-gray-500">Actual in this period</p>
              <p className="text-xl font-semibold">{percent(report.actualOverheadPercent)}</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-600">
            Actual = overhead expenses ÷ direct job costs.
            {overheadGap != null && Math.abs(overheadGap) >= 2
              ? overheadGap > 0
                ? ` Your real overhead is ${overheadGap.toFixed(1)} points higher than the % you set: job reports show more profit than you really make.`
                : ` Your real overhead is ${Math.abs(overheadGap).toFixed(1)} points lower than the % you set.`
              : ''}
          </p>
          <div className="no-print mt-4 border-t border-gray-200 pt-3">
            {settings ? (
              <CostingSettings initialOverhead={settings.overhead} initialRate={settings.rate} onSaved={load} />
            ) : null}
          </div>
        </section>
      </div>

      <section className="rounded-lg border-2 border-black bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold">Jobs</h3>
          <div className="no-print flex flex-wrap gap-2 text-sm">
            {(['all', 'project', 'plan'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`rounded-lg border-2 border-black px-3 py-1 ${filter === value ? 'bg-black text-white' : 'bg-white'}`}
              >
                {value === 'all' ? 'All' : value === 'project' ? 'Projects' : 'Maintenance'}
              </button>
            ))}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as JobSort)}
              className="rounded-lg border-2 border-black bg-white px-2 py-1"
              aria-label="Sort jobs"
            >
              <option value="invoiced">Most invoiced</option>
              <option value="profit">Most profit</option>
              <option value="margin">Best margin</option>
              <option value="cost">Most cost</option>
            </select>
          </div>
        </div>
        {jobs.length === 0 ? (
          <p className="text-sm text-gray-600">No job had invoices or costs in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b-2 border-black text-left text-xs uppercase text-gray-600">
                  <th className="py-2 pr-2">Job</th>
                  <th className="py-2 pr-2">Type</th>
                  <th className="py-2 pr-2 text-right">Invoiced</th>
                  <th className="py-2 pr-2 text-right">Direct cost</th>
                  <th className="py-2 pr-2 text-right">Overhead</th>
                  <th className="py-2 pr-2 text-right">Net profit</th>
                  <th className="py-2 text-right">Margin</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.key} className="border-b border-gray-100">
                    <td className="py-2 pr-2">
                      <Link
                        href={
                          job.kind === 'project'
                            ? `/${locale}/crm/projects/${job.id}`
                            : `/${locale}/crm/maintenance/houses/${job.id}/financials`
                        }
                        className="font-medium hover:underline"
                      >
                        {job.name}
                      </Link>
                    </td>
                    <td className="py-2 pr-2 text-gray-600">{job.kind === 'project' ? 'Project' : 'Maintenance'}</td>
                    <td className="py-2 pr-2 text-right">{money(job.invoicedCents)}</td>
                    <td className="py-2 pr-2 text-right">{money(job.directCostCents)}</td>
                    <td className="py-2 pr-2 text-right text-gray-600">{money(job.overheadCents)}</td>
                    <td className={`py-2 pr-2 text-right font-medium ${job.netProfitCents >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {money(job.netProfitCents)}
                    </td>
                    <td className="py-2 text-right">{percent(job.netMarginPercent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-gray-500">
          Each job&apos;s overhead uses the % you set. Costs and invoices count when they are dated inside the period.
        </p>
      </section>
    </div>
  );
}
