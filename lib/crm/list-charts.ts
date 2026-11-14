import { agingBucket, type AgingBucket } from '@/lib/crm/invoice-books';
import { monthKeyInZone, monthKeyOf, monthKeysEndingNow, todayKeyInZone } from '@/lib/crm/estimate-chart';

const MONTHS = 12;

export interface ChartMonth {
  key: string;
  values: number[];
}

export interface ChartSlice {
  key: string;
  label: string;
  cents: number;
  count: number;
}

interface ChartOptions {
  now?: Date;
  timeZone?: string;
}

function monthSlots(timeZone: string, now: Date, series: number): Map<string, ChartMonth> {
  const keys = monthKeysEndingNow(timeZone, MONTHS, now);
  return new Map(keys.map((key) => [key, { key, values: Array(series).fill(0) }]));
}

function addMonth(slots: Map<string, ChartMonth>, key: string | null, index: number, amount: number) {
  const bar = key ? slots.get(key) : undefined;
  if (!bar) return;
  bar.values[index] += amount;
}

export interface InvoiceChartRow {
  status: string;
  amountCents: number;
  paymentAppliedCents: number;
  dueDate: string | null;
  invoiceDate: string;
}

export interface PaymentChartRow {
  amountCents: number;
  paymentDate: string;
  voided: boolean;
}

export interface InvoiceChart {
  outstandingCents: number;
  collectedCents: number;
  draftCents: number;
  draftCount: number;
  aging: Record<AgingBucket, number>;
  slices: ChartSlice[];
  /** values[0] billed, values[1] collected */
  months: ChartMonth[];
}

const INVOICE_STATUSES = ['draft', 'sent', 'partial', 'paid', 'overdue', 'cancelled'] as const;

export function buildInvoiceChart(
  invoices: InvoiceChartRow[],
  payments: PaymentChartRow[],
  options?: ChartOptions
): InvoiceChart {
  const timeZone = options?.timeZone ?? 'UTC';
  const now = options?.now ?? new Date();
  const today = todayKeyInZone(timeZone, now);
  const aging: Record<AgingBucket, number> = {
    current: 0,
    days1to30: 0,
    days31to60: 0,
    days61to90: 0,
    days90plus: 0,
  };
  const slices = new Map<string, ChartSlice>(
    INVOICE_STATUSES.map((status) => [status, { key: status, label: invoiceSliceLabel(status), cents: 0, count: 0 }])
  );
  let outstandingCents = 0;
  let draftCents = 0;
  let draftCount = 0;
  const slots = monthSlots(timeZone, now, 2);

  for (const invoice of invoices) {
    const amount = Math.round(invoice.amountCents) || 0;
    const applied = Math.max(0, Math.round(invoice.paymentAppliedCents) || 0);
    const slice = slices.get(invoice.status);
    if (slice) {
      slice.cents += amount;
      slice.count += 1;
    }
    if (invoice.status === 'draft') {
      draftCents += amount;
      draftCount += 1;
      continue;
    }
    if (invoice.status === 'cancelled') continue;
    const balance = Math.max(0, amount - applied);
    if (balance > 0) {
      outstandingCents += balance;
      aging[agingBucket(invoice.dueDate, today)] += balance;
    }
    const billedKey = monthKeyOf(invoice.invoiceDate, timeZone);
    addMonth(slots, billedKey, 0, amount);
  }

  let collectedCents = 0;
  for (const payment of payments) {
    if (payment.voided) continue;
    const amount = Math.max(0, Math.round(payment.amountCents) || 0);
    collectedCents += amount;
    addMonth(slots, monthKeyOf(payment.paymentDate, timeZone), 1, amount);
  }

  return {
    outstandingCents,
    collectedCents,
    draftCents,
    draftCount,
    aging,
    slices: INVOICE_STATUSES.map((status) => slices.get(status) as ChartSlice),
    months: [...slots.values()],
  };
}

function invoiceSliceLabel(status: string): string {
  if (status === 'partial') return 'Partial';
  if (status === 'overdue') return 'Overdue';
  if (status === 'cancelled') return 'Cancelled';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export interface ExpenseChartRow {
  amountCents: number;
  expenseDate: string;
  category: string;
}

export interface ExpenseChart {
  spentCents: number;
  thisMonthCents: number;
  collectedCents: number;
  categories: ChartSlice[];
  /** values[0] spent */
  months: ChartMonth[];
}

export function buildExpenseChart(
  expenses: ExpenseChartRow[],
  payments: PaymentChartRow[],
  options?: ChartOptions
): ExpenseChart {
  const timeZone = options?.timeZone ?? 'UTC';
  const now = options?.now ?? new Date();
  const slots = monthSlots(timeZone, now, 1);
  const currentKey = monthKeysEndingNow(timeZone, 1, now)[0];
  const categories = new Map<string, ChartSlice>();
  let spentCents = 0;
  let thisMonthCents = 0;

  for (const expense of expenses) {
    const amount = Math.max(0, Math.round(expense.amountCents) || 0);
    const key = monthKeyOf(expense.expenseDate, timeZone);
    const inWindow = key ? slots.has(key) : false;
    if (!inWindow) continue;
    spentCents += amount;
    addMonth(slots, key, 0, amount);
    if (key === currentKey) thisMonthCents += amount;
    const name = expense.category.trim() || 'Other';
    const categoryKey = name.toLowerCase();
    const slice = categories.get(categoryKey) ?? { key: categoryKey, label: name, cents: 0, count: 0 };
    slice.cents += amount;
    slice.count += 1;
    categories.set(categoryKey, slice);
  }

  let collectedCents = 0;
  for (const payment of payments) {
    if (payment.voided) continue;
    const amount = Math.max(0, Math.round(payment.amountCents) || 0);
    const key = monthKeyOf(payment.paymentDate, timeZone);
    if (key && slots.has(key)) collectedCents += amount;
  }

  const ranked = [...categories.values()].sort((a, b) => b.cents - a.cents || a.label.localeCompare(b.label));
  const top = ranked.slice(0, 6);
  const rest = ranked.slice(6);
  if (rest.length > 0) {
    top.push({
      key: 'other',
      label: 'Other',
      cents: rest.reduce((sum, row) => sum + row.cents, 0),
      count: rest.reduce((sum, row) => sum + row.count, 0),
    });
  }

  return {
    spentCents,
    thisMonthCents,
    collectedCents,
    categories: top,
    months: [...slots.values()],
  };
}

export const PROJECT_STATUSES = ['planned', 'in_progress', 'on_hold', 'completed', 'cancelled'] as const;

export interface ProjectChartRow {
  status: string;
  contractCents: number | null;
  costCents: number;
  startedOn: string;
}

export interface ProjectChart {
  contractCents: number;
  costCents: number;
  profitCents: number;
  slices: ChartSlice[];
  /** values[0] active, values[1] completed, values[2] cancelled — contract dollars */
  months: ChartMonth[];
}

export function buildProjectChart(rows: ProjectChartRow[], options?: ChartOptions): ProjectChart {
  const timeZone = options?.timeZone ?? 'UTC';
  const now = options?.now ?? new Date();
  const slots = monthSlots(timeZone, now, 3);
  const slices = new Map<string, ChartSlice>(
    PROJECT_STATUSES.map((status) => [status, { key: status, label: projectStatusLabel(status), cents: 0, count: 0 }])
  );
  let contractCents = 0;
  let costCents = 0;

  for (const row of rows) {
    const contract = row.contractCents == null ? 0 : Math.max(0, Math.round(row.contractCents) || 0);
    const cost = Math.max(0, Math.round(row.costCents) || 0);
    const slice = slices.get(row.status);
    if (slice) {
      slice.cents += contract;
      slice.count += 1;
    }
    const open = row.status !== 'cancelled';
    if (open) {
      contractCents += contract;
      costCents += cost;
    }
    const series = row.status === 'completed' ? 1 : row.status === 'cancelled' ? 2 : 0;
    addMonth(slots, monthKeyOf(row.startedOn, timeZone) ?? monthKeyInZone(row.startedOn, timeZone), series, contract);
  }

  return {
    contractCents,
    costCents,
    profitCents: contractCents - costCents,
    slices: PROJECT_STATUSES.map((status) => slices.get(status) as ChartSlice),
    months: [...slots.values()],
  };
}

export function isInvoiceChart(value: unknown): value is InvoiceChart {
  return Boolean(value && typeof value === 'object' && 'aging' in value && 'slices' in value);
}

export function isExpenseChart(value: unknown): value is ExpenseChart {
  return Boolean(value && typeof value === 'object' && 'categories' in value && 'spentCents' in value);
}

export function isProjectChart(value: unknown): value is ProjectChart {
  return Boolean(value && typeof value === 'object' && 'profitCents' in value && 'slices' in value);
}

export function isContactChart(value: unknown): value is ContactChart {
  return Boolean(value && typeof value === 'object' && 'thisMonth' in value && 'slices' in value);
}

export function projectStatusLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export interface ContactChartRow {
  createdAt: string;
  roles: { key: string; label: string }[];
}

export interface ContactChart {
  total: number;
  thisMonth: number;
  slices: ChartSlice[];
  /** values[0] new contacts */
  months: ChartMonth[];
}

export function buildContactChart(rows: ContactChartRow[], options?: ChartOptions): ContactChart {
  const timeZone = options?.timeZone ?? 'UTC';
  const now = options?.now ?? new Date();
  const slots = monthSlots(timeZone, now, 1);
  const currentKey = monthKeysEndingNow(timeZone, 1, now)[0];
  const roles = new Map<string, ChartSlice>();
  let thisMonth = 0;

  for (const row of rows) {
    const key = monthKeyInZone(row.createdAt, timeZone);
    addMonth(slots, key, 0, 1);
    if (key === currentKey) thisMonth += 1;
    const names = row.roles.length > 0 ? row.roles : [{ key: '', label: 'No role' }];
    for (const role of names) {
      const slice = roles.get(role.key) ?? { key: role.key, label: role.label, cents: 0, count: 0 };
      slice.count += 1;
      roles.set(role.key, slice);
    }
  }

  const slices = [...roles.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  return {
    total: rows.length,
    thisMonth,
    slices,
    months: [...slots.values()],
  };
}
