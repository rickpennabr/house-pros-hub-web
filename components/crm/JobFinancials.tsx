'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { Clock, Printer, Plus, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { LogHoursModal } from '@/components/crm/LogHoursModal';
import { COST_BUCKET_LABELS, COST_BUCKETS, type JobFinancials as Financials } from '@/lib/crm/job-financials';

interface Response {
  job: { name: string; kind: 'project' | 'plan'; customerId: string | null; status: string; startDate: string | null; endDate: string | null };
  settings: { overheadPercent: number; defaultLaborCentsPerHour: number };
  invoices: Array<{ id: string; invoice_number?: string | null; invoice_date?: string | null; amount_cents: number; payment_applied_cents?: number | null; status: string }>;
  financials: Financials;
}

const money = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

const percent = (value: number | null) => (value == null ? '—' : `${value.toFixed(1)}%`);

const SOURCE_LABELS: Record<Financials['lines'][number]['source'], string> = {
  expense: 'Expense',
  time: 'Hours',
  visit: 'Visit',
  mileage: 'Mileage',
  equipment: 'Equipment',
};

/** Bar colors per bucket: brand red for the big ones, grays for the rest. */
const BUCKET_COLORS: Record<string, string> = {
  materials: '#dc2626',
  labor: '#111827',
  subcontractors: '#6b7280',
  equipment: '#f59e0b',
  permits: '#9ca3af',
  disposal: '#a3a3a3',
  delivery: '#d1d5db',
  mileage: '#fca5a5',
  other: '#e5e7eb',
};

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="rounded-lg border-2 border-black bg-white p-3">
      <p className="text-xs uppercase tracking-wide text-gray-600">{label}</p>
      <p className={`mt-1 text-lg font-semibold md:text-xl ${tone === 'good' ? 'text-green-700' : tone === 'bad' ? 'text-red-600' : 'text-gray-900'}`}>
        {value}
      </p>
    </div>
  );
}

/**
 * The money on one project or maintenance plan: what it brought in, what it cost by bucket
 * (materials, labor, subs, equipment, …), overhead, profit and margin, with every cost line.
 */
export function JobFinancials({ kind, id, header }: { kind: 'project' | 'plan'; id: string; /** Title block, printed with the report. */ header?: ReactNode }) {
  const locale = useLocale();
  const [data, setData] = useState<Response | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hoursOpen, setHoursOpen] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/crm/job-financials?${kind}=${id}`, { credentials: 'include' })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || 'Could not load the financials');
        setData(body as Response);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load the financials'));
  }, [kind, id]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <p className="py-6 text-sm text-red-600">{error}</p>;
  if (!data) return <p className="py-10 text-center text-sm text-gray-500">Loading financials…</p>;

  const fin = data.financials;
  const biggest = Math.max(1, ...COST_BUCKETS.map((bucket) => fin.costs[bucket]));
  const usedBuckets = COST_BUCKETS.filter((bucket) => fin.costs[bucket] > 0);
  const basisNote =
    fin.revenueBasis === 'invoiced'
      ? 'Profit is based on what you invoiced.'
      : fin.revenueBasis === 'contract'
        ? 'Nothing invoiced yet: profit is based on the estimate price.'
        : 'No estimate or invoice yet: add one to see profit.';
  const expenseHref =
    kind === 'project'
      ? `/${locale}/crm/expenses?new=1&projectId=${id}`
      : `/${locale}/crm/expenses?new=1&maintenancePlanId=${id}`;

  return (
    <div className="job-report space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-red-600">
          {kind === 'project' ? 'Project' : 'Maintenance'} financial report
        </p>
        <h1 className="text-xl font-semibold text-gray-900 md:text-2xl">{data.job.name}</h1>
        <p className="text-sm capitalize text-gray-600">
          {data.job.status.replace(/_/g, ' ')}
          {data.job.startDate ? ` · ${data.job.startDate}${data.job.endDate ? ` to ${data.job.endDate}` : ''}` : ''}
        </p>
      </div>
      {header}
      <div className="no-print flex flex-wrap justify-end gap-2">
        <Link href={expenseHref}>
          <Button variant="secondary" size="sm" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" /> Add expense
          </Button>
        </Link>
        <Button variant="secondary" size="sm" className="flex items-center gap-2" onClick={() => setHoursOpen(true)}>
          <Clock className="h-4 w-4" /> Log hours
        </Button>
        {kind === 'project' ? (
          <Link href={`/${locale}/crm/invoices/new?projectId=${id}${data.job.customerId ? `&customerId=${data.job.customerId}` : ""}`}>
            <Button variant="secondary" size="sm" className="flex items-center gap-2">
              <Plus className="h-4 w-4" /> New invoice
            </Button>
          </Link>
        ) : null}
        <Button variant="secondary" size="sm" className="flex items-center gap-2" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Stat label={kind === 'project' ? 'Contract' : 'Plan price'} value={fin.revenue.contractCents != null ? money(fin.revenue.contractCents) : '—'} />
        <Stat label="Invoiced" value={money(fin.revenue.invoicedCents)} />
        <Stat label="Collected" value={money(fin.revenue.collectedCents)} />
        <Stat label="Total cost" value={money(fin.totalCostCents)} />
        <Stat label="Net profit" value={money(fin.netProfitCents)} tone={fin.netProfitCents >= 0 ? 'good' : 'bad'} />
        <Stat label="Net margin" value={percent(fin.netMarginPercent)} tone={(fin.netMarginPercent ?? 0) >= 0 ? 'good' : 'bad'} />
      </div>
      <p className="text-xs text-gray-600">{basisNote}</p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-lg border-2 border-black bg-white p-4">
          <h2 className="mb-3 text-base font-semibold">Costs by type</h2>
          {usedBuckets.length === 0 ? (
            <p className="text-sm text-gray-600">
              No costs yet. Add expenses linked to this {kind === 'project' ? 'project' : 'house'}, log crew hours, or give your
              equipment a daily rate.
            </p>
          ) : (
            <ul className="space-y-2">
              {usedBuckets.map((bucket) => (
                <li key={bucket}>
                  <div className="flex justify-between text-sm">
                    <span>{COST_BUCKET_LABELS[bucket]}</span>
                    <span className="font-medium">
                      {money(fin.costs[bucket])}
                      <span className="ml-2 text-xs text-gray-500">
                        {fin.directCostCents > 0 ? `${Math.round((fin.costs[bucket] / fin.directCostCents) * 100)}%` : ''}
                      </span>
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(fin.costs[bucket] / biggest) * 100}%`, backgroundColor: BUCKET_COLORS[bucket] }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-lg border-2 border-black bg-white p-4">
          <h2 className="mb-3 text-base font-semibold">Profit</h2>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt>Revenue{fin.revenueBasis === 'contract' ? ' (estimate)' : ''}</dt>
              <dd className="font-medium">{money(fin.revenueBasisCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Direct costs</dt>
              <dd>− {money(fin.directCostCents)}</dd>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-1.5">
              <dt className="font-medium">Gross profit</dt>
              <dd className="font-medium">
                {money(fin.grossProfitCents)} <span className="text-xs text-gray-500">{percent(fin.grossMarginPercent)}</span>
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>
                Overhead ({fin.overheadPercent}% of direct costs)
                {fin.overheadPercent === 0 ? (
                  <Link href={`/${locale}/crm/reports?tab=pl`} className="no-print ml-1 text-xs underline">
                    set it
                  </Link>
                ) : null}
              </dt>
              <dd>− {money(fin.overheadCents)}</dd>
            </div>
            <div className="flex justify-between border-t-2 border-black pt-1.5 text-base">
              <dt className="font-semibold">Net profit</dt>
              <dd className={`font-semibold ${fin.netProfitCents >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                {money(fin.netProfitCents)} <span className="text-xs">{percent(fin.netMarginPercent)}</span>
              </dd>
            </div>
          </dl>
          <dl className="mt-4 grid grid-cols-2 gap-2 text-xs text-gray-600">
            <div>
              <dt>Labor hours</dt>
              <dd className="text-sm font-medium text-gray-900">{fin.laborHours} h</dd>
            </div>
            <div>
              <dt>Still owed by customer</dt>
              <dd className="text-sm font-medium text-gray-900">{money(fin.revenue.outstandingCents)}</dd>
            </div>
          </dl>
        </section>
      </div>

      {data.invoices.length > 0 ? (
        <section className="rounded-lg border-2 border-black bg-white p-4">
          <h2 className="mb-3 text-base font-semibold">Invoices</h2>
          <ul className="divide-y divide-gray-200 text-sm">
            {data.invoices.map((invoice) => (
              <li key={invoice.id} className="flex items-center justify-between gap-2 py-2">
                <Link href={`/${locale}/crm/invoices/${invoice.id}`} className="font-medium hover:underline">
                  #{invoice.invoice_number ?? '—'}
                  <span className="ml-2 font-normal text-gray-600">{invoice.invoice_date ?? ''}</span>
                </Link>
                <span className="text-right">
                  {money(invoice.amount_cents)}
                  <span className="ml-2 text-xs capitalize text-gray-500">{invoice.status}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-lg border-2 border-black bg-white p-4">
        <h2 className="mb-3 text-base font-semibold">Every cost</h2>
        {fin.lines.length === 0 ? (
          <p className="text-sm text-gray-600">Nothing spent on this job yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b-2 border-black text-left text-xs uppercase text-gray-600">
                  <th className="py-2 pr-2">Date</th>
                  <th className="py-2 pr-2">Type</th>
                  <th className="py-2 pr-2">Description</th>
                  <th className="py-2 pr-2">From</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {fin.lines.map((line) => (
                  <tr key={`${line.source}-${line.id}`} className="border-b border-gray-100">
                    <td className="whitespace-nowrap py-2 pr-2 text-gray-600">{line.date ?? '—'}</td>
                    <td className="py-2 pr-2">{COST_BUCKET_LABELS[line.bucket]}</td>
                    <td className="py-2 pr-2">{line.description}</td>
                    <td className="py-2 pr-2 text-gray-600">{SOURCE_LABELS[line.source]}</td>
                    <td className="py-2 text-right font-medium">{money(line.amountCents)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} className="pt-2 text-right font-semibold">
                    Direct costs
                  </td>
                  <td className="pt-2 text-right font-semibold">{money(fin.directCostCents)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {hoursOpen ? (
        <LogHoursModal
          job={kind === 'project' ? { projectId: id, name: data.job.name } : { maintenancePlanId: id, name: data.job.name }}
          onClose={() => setHoursOpen(false)}
          onChanged={load}
        />
      ) : null}
    </div>
  );
}
