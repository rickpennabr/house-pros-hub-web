import { summarizeEstimateStatuses, type EstimateStatusSummary } from '@/lib/crm/estimate-books';

export interface EstimateChartRow {
  status: string;
  amountCents: number;
  createdAt: string;
}

export interface EstimateMonthBar {
  /** Calendar month in the requested time zone, YYYY-MM. */
  key: string;
  openCents: number;
  wonCents: number;
  lostCents: number;
}

export interface EstimateChart {
  summary: EstimateStatusSummary;
  open: { count: number; cents: number };
  /** Accepted divided by accepted plus declined. Null when nothing is closed. */
  winRateCents: number | null;
  winRateCount: number | null;
  closedCents: number;
  closedCount: number;
  months: EstimateMonthBar[];
}

const MONTHS = 12;

export function safeTimeZone(value: string | null | undefined): string {
  if (!value) return 'UTC';
  try {
    Intl.DateTimeFormat('en-US', { timeZone: value });
    return value;
  } catch {
    return 'UTC';
  }
}

/**
 * Month key for a stored value.
 * A calendar date (YYYY-MM-DD) keeps its own month. A timestamp uses the time zone.
 */
export function monthKeyOf(value: string, timeZone: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.slice(0, 7);
  return monthKeyInZone(value, timeZone);
}

export function todayKeyInZone(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: safeTimeZone(timeZone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** YYYY-MM for an instant in a time zone. Returns null when the date is invalid. */
export function monthKeyInZone(iso: string, timeZone: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
  return formatted.slice(0, 7);
}

/** `count` calendar months ending at `now`, oldest first. */
export function monthKeysEndingNow(timeZone: string, count: number, now = new Date()): string[] {
  const current = monthKeyInZone(now.toISOString(), timeZone);
  if (!current) return [];
  const [year, month] = current.split('-').map(Number);
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const cursor = new Date(Date.UTC(year, month - 1 - i, 1));
    const y = cursor.getUTCFullYear();
    const m = String(cursor.getUTCMonth() + 1).padStart(2, '0');
    keys.push(`${y}-${m}`);
  }
  return keys;
}

export function buildEstimateChart(
  rows: EstimateChartRow[],
  options?: { now?: Date; timeZone?: string }
): EstimateChart {
  const timeZone = safeTimeZone(options?.timeZone);
  const now = options?.now ?? new Date();
  const summary = summarizeEstimateStatuses(
    rows.map((row) => ({ status: row.status, amountCents: row.amountCents }))
  );
  const open = {
    count: summary.draft.count + summary.sent.count,
    cents: summary.draft.cents + summary.sent.cents,
  };
  const closedCount = summary.accepted.count + summary.declined.count;
  const closedCents = summary.accepted.cents + summary.declined.cents;
  const keys = monthKeysEndingNow(timeZone, MONTHS, now);
  const byMonth = new Map<string, EstimateMonthBar>(
    keys.map((key) => [key, { key, openCents: 0, wonCents: 0, lostCents: 0 }])
  );

  for (const row of rows) {
    const key = monthKeyInZone(row.createdAt, timeZone);
    const bar = key ? byMonth.get(key) : undefined;
    if (!bar) continue;
    const cents = Math.round(row.amountCents) || 0;
    if (row.status === 'draft' || row.status === 'sent') bar.openCents += cents;
    else if (row.status === 'accepted') bar.wonCents += cents;
    else if (row.status === 'declined') bar.lostCents += cents;
  }

  return {
    summary,
    open,
    closedCents,
    closedCount,
    winRateCents: closedCents === 0 ? null : summary.accepted.cents / closedCents,
    winRateCount: closedCount === 0 ? null : summary.accepted.count / closedCount,
    months: keys.map((key) => byMonth.get(key) as EstimateMonthBar),
  };
}
