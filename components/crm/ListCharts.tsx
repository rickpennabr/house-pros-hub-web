import { formatAmount } from '@/lib/invoices/format';
import type { AgingBucket } from '@/lib/crm/invoice-books';
import type { ChartMonth, ChartSlice, ContactChart, ExpenseChart, InvoiceChart, ProjectChart } from '@/lib/crm/list-charts';

const SLICE_COLOR = ['#111111', '#404040', '#737373', '#a3a3a3', '#d4d4d4', '#dc2626', '#7f1d1d', '#b91c1c'];

const INVOICE_COLOR: Record<string, string> = {
  draft: '#d4d4d4',
  sent: '#737373',
  partial: '#404040',
  paid: '#111111',
  overdue: '#dc2626',
  cancelled: '#fecaca',
};

const PROJECT_COLOR: Record<string, string> = {
  planned: '#d4d4d4',
  in_progress: '#404040',
  on_hold: '#a3a3a3',
  completed: '#111111',
  cancelled: '#dc2626',
};

const AGING_ROWS: { key: AgingBucket; label: string; color: string }[] = [
  { key: 'current', label: 'Current', color: '#d4d4d4' },
  { key: 'days1to30', label: '1–30 days', color: '#737373' },
  { key: 'days31to60', label: '31–60 days', color: '#404040' },
  { key: 'days61to90', label: '61–90 days', color: '#b91c1c' },
  { key: 'days90plus', label: 'Over 90 days', color: '#7f1d1d' },
];

export function ChartLoading({ error }: { error: string | null }) {
  return (
    <div className="p-12 text-center text-sm text-gray-500">
      {error ? 'Chart could not be loaded.' : 'Loading chart…'}
    </div>
  );
}

export function InvoiceListChart({
  chart,
  filtered,
  activeStatus,
  onSelectStatus,
}: {
  chart: InvoiceChart;
  filtered: boolean;
  activeStatus: string;
  onSelectStatus: (status: string) => void;
}) {
  return (
    <div className="space-y-4 pb-28">
      {filtered && <p className="text-xs text-gray-500">Showing invoices for this search.</p>}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <RateCard label="Outstanding" value={formatAmount(chart.outstandingCents)} detail="Sent invoices that are not paid in full" />
        <RateCard label="Collected" value={formatAmount(chart.collectedCents)} detail="Payments recorded, not voided" />
        <RateCard
          label="Not sent"
          value={formatAmount(chart.draftCents)}
          detail={`${chart.draftCount} ${chart.draftCount === 1 ? 'draft' : 'drafts'}`}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-lg border-2 border-black bg-white p-4">
          <h2 className="text-base font-semibold text-gray-900">How old the balance is</h2>
          <p className="mt-0.5 text-xs text-gray-500">Open balances as of today. Drafts and cancelled invoices stay off this chart.</p>
          <Bars
            rows={AGING_ROWS.map((row) => ({
              key: row.key,
              label: row.label,
              valueLabel: formatAmount(chart.aging[row.key]),
              amount: chart.aging[row.key],
              color: row.color,
            }))}
          />
        </section>
        <section className="rounded-lg border-2 border-black bg-white p-4">
          <h2 className="text-base font-semibold text-gray-900">By status</h2>
          <p className="mt-0.5 text-xs text-gray-500">Sized by invoice amount.</p>
          <SliceBody
            slices={chart.slices}
            colorFor={(slice) => INVOICE_COLOR[slice.key] ?? '#111111'}
            activeKey={activeStatus}
            onSelect={onSelectStatus}
            valueLabel={(slice) => formatAmount(slice.cents)}
          />
        </section>
      </div>
      <section className="rounded-lg border-2 border-black bg-white p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold text-gray-900">Last 12 months</h2>
          <p className="text-xs text-gray-500">Billed against payments received</p>
        </div>
        <MonthColumns
          months={chart.months}
          series={[
            { name: 'Billed', color: '#111111' },
            { name: 'Collected', color: '#a3a3a3' },
          ]}
          grouped
          formatValue={formatAmount}
        />
      </section>
    </div>
  );
}

export function ExpenseListChart({
  chart,
  filtered,
}: {
  chart: ExpenseChart;
  filtered: boolean;
}) {
  const result = chart.collectedCents - chart.spentCents;
  return (
    <div className="space-y-4 pb-28">
      {filtered && (
        <p className="text-xs text-gray-500">Spend follows this search. Collected stays the whole company.</p>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <RateCard label="Spent" value={formatAmount(chart.spentCents)} detail="Last 12 months" />
        <RateCard label="This month" value={formatAmount(chart.thisMonthCents)} detail="Expenses dated this month" />
        <RateCard
          label="Cash result"
          value={formatAmount(result)}
          detail={`${formatAmount(chart.collectedCents)} collected minus spend`}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-lg border-2 border-black bg-white p-4">
          <h2 className="text-base font-semibold text-gray-900">By category</h2>
          <p className="mt-0.5 text-xs text-gray-500">Last 12 months. The top six, then the rest as Other.</p>
          {chart.categories.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">No expenses in the last 12 months.</p>
          ) : (
            <Bars
              rows={chart.categories.map((row, index) => ({
                key: row.key,
                label: row.label,
                valueLabel: formatAmount(row.cents),
                amount: row.cents,
                color: SLICE_COLOR[index % SLICE_COLOR.length],
              }))}
            />
          )}
        </section>
        <section className="rounded-lg border-2 border-black bg-white p-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-base font-semibold text-gray-900">Last 12 months</h2>
            <p className="text-xs text-gray-500">What you spent</p>
          </div>
          <MonthColumns
            months={chart.months}
            series={[{ name: 'Spent', color: '#111111' }]}
            formatValue={formatAmount}
          />
        </section>
      </div>
    </div>
  );
}

export function ProjectListChart({
  chart,
  filtered,
  activeStatus,
  onSelectStatus,
}: {
  chart: ProjectChart;
  filtered: boolean;
  activeStatus: string;
  onSelectStatus: (status: string) => void;
}) {
  const contractTotal = chart.slices.reduce((sum, slice) => sum + slice.cents, 0);
  const countTotal = chart.slices.reduce((sum, slice) => sum + slice.count, 0);
  return (
    <div className="space-y-4 pb-28">
      {filtered && <p className="text-xs text-gray-500">Showing projects for this search.</p>}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <RateCard label="Contract" value={formatAmount(chart.contractCents)} detail="Open and finished jobs. Cancelled stays out." />
        <RateCard label="Job cost" value={formatAmount(chart.costCents)} detail="Expenses on those jobs" />
        <RateCard label="Profit" value={formatAmount(chart.profitCents)} detail="Contract minus job cost" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-lg border-2 border-black bg-white p-4">
          <h2 className="text-base font-semibold text-gray-900">By status</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            {contractTotal === 0 && countTotal > 0 ? 'Sized by number of jobs. No contract amounts yet.' : 'Sized by contract amount.'}
          </p>
          <SliceBody
            slices={chart.slices}
            colorFor={(slice) => PROJECT_COLOR[slice.key] ?? '#111111'}
            activeKey={activeStatus}
            onSelect={onSelectStatus}
            valueLabel={(slice) => (slice.cents > 0 || contractTotal > 0 ? formatAmount(slice.cents) : String(slice.count))}
          />
        </section>
        <section className="rounded-lg border-2 border-black bg-white p-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-base font-semibold text-gray-900">Last 12 months</h2>
            <p className="text-xs text-gray-500">Contract amount of jobs started</p>
          </div>
          <MonthColumns
            months={chart.months}
            series={[
              { name: 'Active', color: '#a3a3a3' },
              { name: 'Completed', color: '#111111' },
              { name: 'Cancelled', color: '#dc2626' },
            ]}
            formatValue={formatAmount}
          />
        </section>
      </div>
    </div>
  );
}

export function ContactListChart({
  chart,
  filtered,
  activeRole,
  onSelectRole,
}: {
  chart: ContactChart;
  filtered: boolean;
  activeRole: string;
  onSelectRole: (role: string) => void;
}) {
  return (
    <div className="space-y-4 pb-28">
      {filtered && <p className="text-xs text-gray-500">Showing contacts for this search.</p>}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <RateCard label="Contacts" value={String(chart.total)} detail="In this view" />
        <RateCard label="New this month" value={String(chart.thisMonth)} detail="Added this calendar month" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-lg border-2 border-black bg-white p-4">
          <h2 className="text-base font-semibold text-gray-900">By role</h2>
          <p className="mt-0.5 text-xs text-gray-500">A contact with two roles is counted in both.</p>
          <SliceBody
            slices={chart.slices}
            colorFor={(_slice, index) => SLICE_COLOR[index % SLICE_COLOR.length]}
            activeKey={activeRole}
            onSelect={onSelectRole}
            valueLabel={(slice) => String(slice.count)}
            centerLabel={String(chart.total)}
            centerDetail={chart.total === 1 ? 'contact' : 'contacts'}
          />
        </section>
        <section className="rounded-lg border-2 border-black bg-white p-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-base font-semibold text-gray-900">Last 12 months</h2>
            <p className="text-xs text-gray-500">Contacts added</p>
          </div>
          <MonthColumns
            months={chart.months}
            series={[{ name: 'Added', color: '#111111' }]}
            formatValue={(value) => new Intl.NumberFormat().format(value)}
          />
        </section>
      </div>
    </div>
  );
}

function RateCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border-2 border-black bg-white px-3 py-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{detail}</p>
    </div>
  );
}

function Bars({ rows }: { rows: { key: string; label: string; valueLabel: string; amount: number; color: string }[] }) {
  const max = Math.max(1, ...rows.map((row) => row.amount));
  return (
    <ul className="mt-4 space-y-3">
      {rows.map((row) => (
        <li key={row.key}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span>{row.label}</span>
            <span className="font-medium">{row.valueLabel}</span>
          </div>
          <div className="mt-1 h-3 rounded-sm bg-gray-100">
            <div
              className="h-3 rounded-sm border border-black"
              style={{ width: `${Math.max(row.amount > 0 ? 2 : 0, (row.amount / max) * 100)}%`, backgroundColor: row.color }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function SliceBody({
  slices,
  colorFor,
  activeKey,
  onSelect,
  valueLabel,
  centerLabel,
  centerDetail,
}: {
  slices: ChartSlice[];
  colorFor: (slice: ChartSlice, index: number) => string;
  activeKey: string;
  onSelect: (key: string) => void;
  valueLabel: (slice: ChartSlice) => string;
  centerLabel?: string;
  centerDetail?: string;
}) {
  const byCount = slices.every((slice) => slice.cents === 0);
  const total = slices.reduce((sum, slice) => sum + (byCount ? slice.count : slice.cents), 0);
  const totalCount = slices.reduce((sum, slice) => sum + slice.count, 0);
  const center = centerLabel ?? (byCount ? String(totalCount) : formatAmount(slices.reduce((sum, slice) => sum + slice.cents, 0)));
  const detail = centerDetail ?? String(totalCount);

  return (
    <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <Donut slices={slices} total={total} byCount={byCount} center={center} detail={detail} colorFor={colorFor} />
      <ul className="w-full min-w-0 flex-1 space-y-1">
        {slices.map((slice, index) => {
          const selected = activeKey === slice.key && slice.key !== '';
          return (
            <li key={slice.key || 'none'}>
              <button
                type="button"
                onClick={() => slice.key && onSelect(selected ? '' : slice.key)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${slice.key ? 'cursor-pointer' : 'cursor-default'} ${selected ? 'bg-black text-white' : 'hover:bg-gray-100'}`}
              >
                <span className="h-3 w-3 shrink-0 rounded-sm border border-black" style={{ backgroundColor: colorFor(slice, index) }} />
                <span className="min-w-0 flex-1 truncate">{slice.label}</span>
                <span className="font-medium">{valueLabel(slice)}</span>
                {!byCount && (
                  <span className={`w-10 shrink-0 text-right text-xs ${selected ? 'text-white' : 'text-gray-500'}`}>{slice.count}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Donut({
  slices,
  total,
  byCount,
  center,
  detail,
  colorFor,
}: {
  slices: ChartSlice[];
  total: number;
  byCount: boolean;
  center: string;
  detail: string;
  colorFor: (slice: ChartSlice, index: number) => string;
}) {
  const size = 168;
  const stroke = 26;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const middle = size / 2;
  let offset = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" role="img" aria-label={center}>
      <g transform={`rotate(-90 ${middle} ${middle})`}>
        {total === 0 ? (
          <circle cx={middle} cy={middle} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
        ) : (
          slices.map((slice, index) => {
            const value = byCount ? slice.count : slice.cents;
            if (value <= 0) return null;
            const length = (value / total) * circumference;
            const circle = (
              <circle
                key={slice.key || 'none'}
                cx={middle}
                cy={middle}
                r={radius}
                fill="none"
                stroke={colorFor(slice, index)}
                strokeWidth={stroke}
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-offset}
              >
                <title>{`${slice.label} ${value}`}</title>
              </circle>
            );
            offset += length;
            return circle;
          })
        )}
      </g>
      <text x={middle} y={middle - 4} textAnchor="middle" fill="#111827" fontSize="13" fontWeight="600">
        {center}
      </text>
      <text x={middle} y={middle + 14} textAnchor="middle" fill="#6b7280" fontSize="11">
        {detail}
      </text>
    </svg>
  );
}

function MonthColumns({
  months,
  series,
  formatValue,
  grouped = false,
}: {
  months: ChartMonth[];
  series: { name: string; color: string }[];
  formatValue: (cents: number) => string;
  grouped?: boolean;
}) {
  const peak = Math.max(0, ...months.map((month) => (
    grouped ? Math.max(0, ...month.values) : month.values.reduce((sum, value) => sum + value, 0)
  )));
  const max = Math.max(peak, 1);
  const width = 640;
  const height = 200;
  const padLeft = 4;
  const padRight = 4;
  const padTop = 8;
  const padBottom = 36;
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;
  const gap = 8;
  const groupWidth = (plotWidth - gap * (months.length - 1)) / months.length;

  return (
    <div className="mt-3">
      <div className="mb-1 flex justify-end text-xs text-gray-500">{formatValue(peak)}</div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Amounts by month">
        <line x1={padLeft} y1={padTop + plotHeight} x2={width - padRight} y2={padTop + plotHeight} stroke="#111111" strokeWidth={2} />
        {months.map((month, index) => {
          const x = padLeft + index * (groupWidth + gap);
          const [year, monthNumber] = month.key.split('-').map(Number);
          const label = new Date(year, monthNumber - 1, 1).toLocaleDateString(undefined, { month: 'short' });
          const showYear = index === 0 || month.key.endsWith('-01');
          const barCount = grouped ? series.length : 1;
          const innerGap = grouped ? 2 : 0;
          const barWidth = (groupWidth - innerGap * (barCount - 1)) / barCount;
          let stackY = padTop + plotHeight;
          return (
            <g key={month.key}>
              {grouped
                ? series.map((item, seriesIndex) => {
                    const amount = month.values[seriesIndex] ?? 0;
                    const barHeight = (amount / max) * plotHeight;
                    if (barHeight <= 0) return null;
                    const barX = x + seriesIndex * (barWidth + innerGap);
                    return (
                      <rect key={item.name} x={barX} y={padTop + plotHeight - barHeight} width={barWidth} height={barHeight} fill={item.color}>
                        <title>{`${label} ${year}: ${item.name} ${formatValue(amount)}`}</title>
                      </rect>
                    );
                  })
                : series.map((item, seriesIndex) => {
                    const amount = month.values[seriesIndex] ?? 0;
                    const barHeight = (amount / max) * plotHeight;
                    if (barHeight <= 0) return null;
                    stackY -= barHeight;
                    return (
                      <rect key={item.name} x={x} y={stackY} width={groupWidth} height={barHeight} fill={item.color}>
                        <title>{`${label} ${year}: ${item.name} ${formatValue(amount)}`}</title>
                      </rect>
                    );
                  })}
              <text x={x + groupWidth / 2} y={height - 16} textAnchor="middle" fill="#374151" fontSize="11">{label}</text>
              {showYear && (
                <text x={x + groupWidth / 2} y={height - 4} textAnchor="middle" fill="#9ca3af" fontSize="10">{year}</text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-600">
        {series.map((item) => (
          <span key={item.name} className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border border-black" style={{ backgroundColor: item.color }} />
            {item.name}
          </span>
        ))}
      </div>
    </div>
  );
}
