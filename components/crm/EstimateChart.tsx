import { formatAmount } from '@/lib/invoices/format';
import {
  ESTIMATE_STATUSES,
  type EstimateStatusKey,
  type EstimateStatusSummary,
} from '@/lib/crm/estimate-books';
import type { EstimateChart as EstimateChartData, EstimateMonthBar } from '@/lib/crm/estimate-chart';

const SLICE_COLOR: Record<EstimateStatusKey, string> = {
  draft: '#d4d4d4',
  sent: '#525252',
  accepted: '#111111',
  declined: '#dc2626',
};

const STACK_COLOR = {
  won: '#111111',
  open: '#a3a3a3',
  lost: '#dc2626',
} as const;

interface EstimateChartProps {
  chart: EstimateChartData;
  filtered: boolean;
  activeStatus: string;
  onSelectStatus: (status: string) => void;
}

function statusLabel(status: EstimateStatusKey): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatRate(rate: number | null): string {
  if (rate == null) return '—';
  return `${Math.round(rate * 100)}%`;
}

function formatAxis(cents: number): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    notation: dollars >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: dollars >= 1000 ? 1 : 0,
  }).format(dollars);
}

function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'short' });
}

function sliceValue(summary: EstimateStatusSummary, status: EstimateStatusKey, byCount: boolean): number {
  const bucket = summary[status];
  return byCount ? bucket.count : bucket.cents;
}

export function EstimateChart({ chart, filtered, activeStatus, onSelectStatus }: EstimateChartProps) {
  const summary = chart.summary;
  const totalCents = ESTIMATE_STATUSES.reduce((sum, status) => sum + summary[status].cents, 0);
  const totalCount = ESTIMATE_STATUSES.reduce((sum, status) => sum + summary[status].count, 0);
  const sizeByCount = totalCents === 0 && totalCount > 0;
  const donutTotal = ESTIMATE_STATUSES.reduce(
    (sum, status) => sum + sliceValue(summary, status, sizeByCount),
    0
  );

  return (
    <div className="space-y-4 pb-28">
      {filtered && (
        <p className="text-xs text-gray-500">Showing estimates for this customer search.</p>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <RateCard
          label="Still open"
          value={formatAmount(chart.open.cents)}
          detail={`${chart.open.count} ${chart.open.count === 1 ? 'estimate' : 'estimates'} still open`}
        />
        <RateCard
          label="Win rate"
          value={formatRate(chart.winRateCents)}
          detail={
            chart.winRateCents == null
              ? 'No closed estimate amounts yet'
              : `${formatAmount(summary.accepted.cents)} of ${formatAmount(chart.closedCents)} closed`
          }
        />
        <RateCard
          label="Estimates won"
          value={formatRate(chart.winRateCount)}
          detail={
            chart.winRateCount == null
              ? 'No closed estimates yet'
              : `${summary.accepted.count} of ${chart.closedCount} closed estimates`
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-lg border-2 border-black bg-white p-4">
          <h2 className="text-base font-semibold text-gray-900">By status</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            {sizeByCount ? 'Sized by number of estimates. Amounts are zero.' : 'Sized by dollars.'}
          </p>
          <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-center">
            <StatusDonut summary={summary} total={donutTotal} totalCents={totalCents} totalCount={totalCount} byCount={sizeByCount} />
            <ul className="w-full min-w-0 flex-1 space-y-1">
              {ESTIMATE_STATUSES.map((status) => {
                const selected = activeStatus === status;
                const bucket = summary[status];
                return (
                  <li key={status}>
                    <button
                      type="button"
                      onClick={() => onSelectStatus(selected ? '' : status)}
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm cursor-pointer ${selected ? 'bg-black text-white' : 'hover:bg-gray-100'}`}
                    >
                      <span
                        className="h-3 w-3 shrink-0 rounded-sm border border-black"
                        style={{ backgroundColor: SLICE_COLOR[status] }}
                      />
                      <span className="w-20 shrink-0">{statusLabel(status)}</span>
                      <span className="ml-auto font-medium">{formatAmount(bucket.cents)}</span>
                      <span className={`w-16 shrink-0 text-right text-xs ${selected ? 'text-white' : 'text-gray-500'}`}>
                        {bucket.count}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        <section className="rounded-lg border-2 border-black bg-white p-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-base font-semibold text-gray-900">Last 12 months</h2>
            <p className="text-xs text-gray-500">Quotes created, by outcome</p>
          </div>
          <MonthColumns months={chart.months} />
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

function StatusDonut({
  summary,
  total,
  totalCents,
  totalCount,
  byCount,
}: {
  summary: EstimateStatusSummary;
  total: number;
  totalCents: number;
  totalCount: number;
  byCount: boolean;
}) {
  const size = 168;
  const stroke = 26;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  let offset = 0;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`${formatAmount(totalCents)} across ${totalCount} estimates`}
      className="shrink-0"
    >
      <g transform={`rotate(-90 ${center} ${center})`}>
            {total === 0 ? (
          <circle cx={center} cy={center} r={radius} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
        ) : (
          ESTIMATE_STATUSES.map((status) => {
            const value = sliceValue(summary, status, byCount);
            if (value <= 0) return null;
            const length = (value / total) * circumference;
            const dash = `${length} ${circumference - length}`;
            const circle = (
              <circle
                key={status}
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke={SLICE_COLOR[status]}
                strokeWidth={stroke}
                strokeDasharray={dash}
                strokeDashoffset={-offset}
              >
                <title>{`${statusLabel(status)} ${formatAmount(summary[status].cents)}, ${summary[status].count}`}</title>
              </circle>
            );
            offset += length;
            return circle;
          })
        )}
      </g>
      <text x={center} y={center - 4} textAnchor="middle" fill="#111827" fontSize="13" fontWeight="600">
        {formatAmount(totalCents)}
      </text>
      <text x={center} y={center + 14} textAnchor="middle" fill="#6b7280" fontSize="11">
        {totalCount} {totalCount === 1 ? 'estimate' : 'estimates'}
      </text>
    </svg>
  );
}

function MonthColumns({ months }: { months: EstimateMonthBar[] }) {
  const peak = Math.max(0, ...months.map((month) => month.openCents + month.wonCents + month.lostCents));
  const max = Math.max(peak, 1);
  const width = 640;
  const height = 200;
  const padLeft = 4;
  const padRight = 4;
  const padTop = 8;
  const padBottom = 36;
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;
  const gap = 10;
  const barWidth = (plotWidth - gap * (months.length - 1)) / months.length;

  return (
    <div className="mt-3">
      <div className="mb-1 flex justify-end text-xs text-gray-500">{formatAxis(peak)}</div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Estimate amounts by month">
        <line
          x1={padLeft}
          y1={padTop + plotHeight}
          x2={width - padRight}
          y2={padTop + plotHeight}
          stroke="#111111"
          strokeWidth={2}
        />
        {months.map((month, index) => {
          const x = padLeft + index * (barWidth + gap);
          const parts = [
            { cents: month.wonCents, color: STACK_COLOR.won, name: 'Won' },
            { cents: month.openCents, color: STACK_COLOR.open, name: 'Open' },
            { cents: month.lostCents, color: STACK_COLOR.lost, name: 'Lost' },
          ];
          let y = padTop + plotHeight;
          const total = month.openCents + month.wonCents + month.lostCents;
          const [year] = month.key.split('-');
          const showYear = index === 0 || month.key.endsWith('-01');
          return (
            <g key={month.key}>
              {parts.map((part) => {
                const barHeight = (part.cents / max) * plotHeight;
                y -= barHeight;
                if (barHeight <= 0) return null;
                return (
                  <rect key={part.name} x={x} y={y} width={barWidth} height={barHeight} fill={part.color}>
                    <title>{`${monthLabel(month.key)} ${year}: ${part.name} ${formatAmount(part.cents)}`}</title>
                  </rect>
                );
              })}
              {total === 0 ? null : (
                <title>{`${monthLabel(month.key)} ${year}: ${formatAmount(total)}`}</title>
              )}
              <text x={x + barWidth / 2} y={height - 16} textAnchor="middle" fill="#374151" fontSize="11">
                {monthLabel(month.key)}
              </text>
              {showYear && (
                <text x={x + barWidth / 2} y={height - 4} textAnchor="middle" fill="#9ca3af" fontSize="10">
                  {year}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-600">
        <LegendSwatch color={STACK_COLOR.won} label="Won" />
        <LegendSwatch color={STACK_COLOR.open} label="Open" />
        <LegendSwatch color={STACK_COLOR.lost} label="Lost" />
      </div>
    </div>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-3 w-3 rounded-sm border border-black" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
