'use client';

import { useEffect, useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import type { TaxYearSummary } from '@/lib/tax/year-summary';

const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

/** CSV for the accountant: one line per figure, Schedule C lines included. */
function summaryCsv(s: TaxYearSummary): string {
  const rows: string[][] = [['Section', 'Line', 'Item', 'Amount']];
  const add = (section: string, line: string, item: string, cents: number) => rows.push([section, line, item, (cents / 100).toFixed(2)]);
  add('Income', '1', 'Gross receipts (payments received)', s.grossReceiptsCents);
  for (const line of s.lines) add('Expenses', line.line, line.label, line.deductibleCents);
  add('Vehicle', '9', `Car and truck (${s.mileage.best === 'standard' ? `standard mileage ${s.mileage.miles} mi × ${s.mileage.rateCents}¢` : 'actual costs'})`, s.mileage.bestCents);
  add('Totals', '28', 'Total deductions', s.totalDeductionsCents);
  add('Totals', '31', 'Net profit', s.netProfitCents);
  add('Estimate', 'SE', 'Self-employment tax estimate', s.selfEmploymentTaxCents);
  for (const row of s.form1099) add('1099-NEC', '', `${row.name}${row.hasW9 ? '' : ' (W-9 missing)'}`, row.paidCents);
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return rows.map((r) => r.map(esc).join(',')).join('\n');
}

export function TaxSummaryReport() {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [data, setData] = useState<TaxYearSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/crm/reports/tax?year=${year}`, { credentials: 'include' });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || 'Could not load the tax summary');
        if (!cancelled) setData(body as TaxYearSummary);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load the tax summary');
      } finally {
        if (!cancelled) setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [year]);

  const download = () => {
    if (!data) return;
    const blob = new Blob([summaryCsv(data)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tax-summary-${data.year}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="w-40 text-sm text-gray-700">
          Tax year
          <Select value={String(year)} onChange={(e) => setYear(Number(e.target.value))} className="mt-1">
            {[0, 1, 2, 3].map((back) => (
              <option key={back} value={thisYear - back}>{thisYear - back}</option>
            ))}
          </Select>
        </label>
        <Button type="button" size="sm" variant="secondary" onClick={download} disabled={!data}>
          <Download className="mr-1 h-4 w-4" aria-hidden /> CSV for your accountant
        </Button>
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-gray-600"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Adding up your year…</p>
      ) : error ? (
        <p className="rounded-lg border-2 border-red-600 p-3 text-sm text-red-700">{error}</p>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ['Income received', data.grossReceiptsCents],
              ['Deductions', data.totalDeductionsCents],
              ['Net profit', data.netProfitCents],
              ['Self-employment tax (est.)', data.selfEmploymentTaxCents],
            ].map(([label, cents]) => (
              <div key={label as string} className="rounded-lg border-2 border-black p-3">
                <p className="text-xs text-gray-600">{label}</p>
                <p className="text-lg font-semibold">{money(cents as number)}</p>
              </div>
            ))}
          </div>

          <section className="rounded-lg border-2 border-black">
            <h3 className="border-b border-gray-200 px-3 py-2 font-semibold">Expenses by Schedule C line</h3>
            {data.lines.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-600">No expenses recorded for {data.year}.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {data.lines.map((line) => (
                  <li key={line.key} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span><span className="mr-2 inline-block w-14 text-gray-500">Line {line.line}</span>{line.label}</span>
                    <span className="font-medium">
                      {money(line.deductibleCents)}
                      {line.spentCents !== line.deductibleCents ? <span className="ml-1 text-xs text-gray-500">of {money(line.spentCents)}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-lg border-2 border-black p-3 text-sm">
            <h3 className="mb-1 font-semibold">Vehicle: standard mileage or actual costs</h3>
            <p>
              {data.mileage.miles} business miles × {data.mileage.rateCents}¢ = <strong>{money(data.mileage.standardCents)}</strong> standard,
              against <strong>{money(data.mileage.actualCents)}</strong> in fuel, repairs and other vehicle costs.
            </p>
            <p className="mt-1">
              Using <strong>{data.mileage.best === 'standard' ? 'standard mileage' : 'actual costs'}</strong> ({money(data.mileage.bestCents)}): the larger deduction.
              To use standard mileage, it must be chosen the first year the vehicle is used for business.
            </p>
          </section>

          <section className="rounded-lg border-2 border-black p-3 text-sm">
            <h3 className="mb-1 font-semibold">To do before you file</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>Quarterly estimated payment (self-employment tax only): about {money(data.quarterlySeTaxCents)}. Income tax comes on top.</li>
              {data.form1099.length > 0 ? (
                <li>
                  Send 1099-NEC by January 31 to: {data.form1099.map((row) => `${row.name} (${money(row.paidCents)}${row.hasW9 ? '' : ', W-9 missing'})`).join('; ')}.
                </li>
              ) : (
                <li>No 1099-NEC needed (no subcontractor paid $600 or more by cash, check or transfer).</li>
              )}
              {data.missingReceipts.length > 0 ? <li>{data.missingReceipts.length} expenses of $75 or more have no receipt. Add them in Expenses.</li> : null}
              {data.uncategorizedCount > 0 ? <li>{data.uncategorizedCount} expenses are in &quot;Other&quot;. A category puts them on the right line.</li> : null}
            </ul>
          </section>

          <p className="text-xs text-gray-600">
            Estimates from your Hub books to prepare your taxes, not tax advice. Review them with your tax professional.
          </p>
        </>
      ) : null}
    </div>
  );
}
