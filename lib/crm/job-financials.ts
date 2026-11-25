/**
 * Job costing: what a project or maintenance plan earned, what it cost (by bucket), overhead, and profit.
 * Pure functions, shared by the job reports, the projects list, and the business P&L.
 */

/** Expense categories that are costs of a specific job. */
export const JOB_COST_CATEGORIES = [
  'Materials',
  'Delivery',
  'Labor',
  'Subcontractor',
  'Equipment',
  'Permits',
  'Disposal',
  'Fuel',
  'Tools',
] as const;

/** Overhead for contractors, realtors, handymen, and other house pros. */
export const BUSINESS_COST_CATEGORIES = [
  'Vehicle',
  'Mileage',
  'Insurance',
  'Workers comp',
  'Advertising',
  'Marketing',
  'Signs',
  'Photography',
  'Staging',
  'Commissions',
  'Office',
  'Accounting',
  'Software',
  'Card fees',
  'Phone',
  'Rent',
  'Utilities',
  'Licenses',
  'Supplies',
  'Meals',
  'Payroll',
  'Taxes',
  'Repairs',
  'Training',
  'Dues',
] as const;

export const COST_BUCKETS = [
  'materials',
  'labor',
  'subcontractors',
  'equipment',
  'permits',
  'disposal',
  'delivery',
  'mileage',
  'other',
] as const;
export type CostBucket = (typeof COST_BUCKETS)[number];

export const COST_BUCKET_LABELS: Record<CostBucket, string> = {
  materials: 'Materials',
  labor: 'Labor',
  subcontractors: 'Subcontractors',
  equipment: 'Equipment',
  permits: 'Permits and fees',
  disposal: 'Disposal',
  delivery: 'Delivery and fuel',
  mileage: 'Mileage',
  other: 'Other',
};

function key(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

/** True when the category is an overhead (business) cost rather than a job cost. */
export function isOverheadCategory(category: string | null | undefined): boolean {
  const k = key(category);
  return BUSINESS_COST_CATEGORIES.some((item) => key(item) === k);
}

/** The cost bucket an expense category counts in on a job report. */
export function bucketForCategory(category: string | null | undefined): CostBucket {
  switch (key(category)) {
    case 'materials':
    case 'supplies':
      return 'materials';
    case 'labor':
    case 'payroll':
    case 'workers comp':
      return 'labor';
    case 'subcontractor':
    case 'subcontractors':
      return 'subcontractors';
    case 'equipment':
    case 'equipment rental':
    case 'tools':
    case 'repairs':
      return 'equipment';
    case 'permits':
    case 'licenses':
      return 'permits';
    case 'disposal':
      return 'disposal';
    case 'delivery':
    case 'fuel':
      return 'delivery';
    case 'mileage':
    case 'vehicle':
      return 'mileage';
    default:
      return 'other';
  }
}

export interface FinInvoice {
  id: string;
  invoice_number?: string | null;
  invoice_date?: string | null;
  amount_cents: number;
  payment_applied_cents?: number | null;
  status: string;
}

export interface FinExpense {
  id: string;
  amount_cents: number;
  category: string;
  expense_date: string;
  description?: string | null;
  note?: string | null;
}

export interface FinTimeEntry {
  id: string;
  work_date: string;
  hours: number | string;
  rate_cents_per_hour: number;
  person_name?: string | null;
  note?: string | null;
}

/** Worker time from maintenance visits (person-seconds) priced at a crew rate. */
export interface FinVisitLabor {
  id: string;
  date: string;
  laborSeconds: number;
  rateCentsPerHour: number;
}

export interface FinMileage {
  id: string;
  trip_date: string;
  amount_cents: number;
  miles?: number | string | null;
  /** Trips that already became an expense are counted through the expense. */
  expense_id?: string | null;
  /** 'estimate' trips are a cost of selling: company cost, never a project cost. */
  purpose?: string | null;
}

export interface FinToolDays {
  toolId: string;
  name: string;
  days: number;
  dailyRateCents: number;
}

export interface JobFinancialsInput {
  /** Estimate or plan price agreed with the customer; null when there is none. */
  contractCents: number | null;
  invoices: FinInvoice[];
  expenses: FinExpense[];
  timeEntries?: FinTimeEntry[];
  visitLabor?: FinVisitLabor[];
  mileage?: FinMileage[];
  toolDays?: FinToolDays[];
  /** Overhead added on top of direct cost, e.g. 15. */
  overheadPercent: number;
}

export interface CostLine {
  id: string;
  date: string | null;
  bucket: CostBucket;
  source: 'expense' | 'time' | 'visit' | 'mileage' | 'equipment';
  description: string;
  amountCents: number;
}

export interface JobFinancials {
  revenue: {
    contractCents: number | null;
    invoicedCents: number;
    collectedCents: number;
    outstandingCents: number;
    invoiceCount: number;
  };
  costs: Record<CostBucket, number>;
  directCostCents: number;
  overheadPercent: number;
  overheadCents: number;
  totalCostCents: number;
  /** Revenue the margins are based on: invoiced, or the contract while nothing is invoiced. */
  revenueBasisCents: number;
  revenueBasis: 'invoiced' | 'contract' | 'none';
  grossProfitCents: number;
  netProfitCents: number;
  grossMarginPercent: number | null;
  netMarginPercent: number | null;
  laborHours: number;
  lines: CostLine[];
}

function num(value: number | string | null | undefined): number {
  const n = typeof value === 'string' ? Number(value) : value ?? 0;
  return Number.isFinite(n) ? (n as number) : 0;
}

export function emptyCosts(): Record<CostBucket, number> {
  return Object.fromEntries(COST_BUCKETS.map((bucket) => [bucket, 0])) as Record<CostBucket, number>;
}

function percentOf(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;
}

/** Invoices that count as revenue: sent or paid, not drafts and not cancelled. */
export function isBilledInvoice(status: string): boolean {
  return status !== 'draft' && status !== 'cancelled';
}

export function buildJobFinancials(input: JobFinancialsInput): JobFinancials {
  const billed = input.invoices.filter((invoice) => isBilledInvoice(invoice.status));
  const invoicedCents = billed.reduce((sum, invoice) => sum + (invoice.amount_cents ?? 0), 0);
  const collectedCents = billed.reduce((sum, invoice) => sum + (invoice.payment_applied_cents ?? 0), 0);

  const lines: CostLine[] = [];
  for (const expense of input.expenses) {
    lines.push({
      id: expense.id,
      date: expense.expense_date,
      bucket: bucketForCategory(expense.category),
      source: 'expense',
      description: [expense.category, expense.description?.trim() || expense.note?.trim()].filter(Boolean).join(' · '),
      amountCents: expense.amount_cents ?? 0,
    });
  }
  let laborHours = 0;
  for (const entry of input.timeEntries ?? []) {
    const hours = num(entry.hours);
    laborHours += hours;
    lines.push({
      id: entry.id,
      date: entry.work_date,
      bucket: 'labor',
      source: 'time',
      description: `${entry.person_name?.trim() || 'Crew'} · ${hours} h × $${(entry.rate_cents_per_hour / 100).toFixed(2)}`,
      amountCents: Math.round(hours * entry.rate_cents_per_hour),
    });
  }
  for (const visit of input.visitLabor ?? []) {
    const hours = Math.round((visit.laborSeconds / 3600) * 100) / 100;
    if (hours <= 0) continue;
    laborHours += hours;
    lines.push({
      id: visit.id,
      date: visit.date,
      bucket: 'labor',
      source: 'visit',
      description: `Visit crew time · ${hours} h × $${(visit.rateCentsPerHour / 100).toFixed(2)}`,
      amountCents: Math.round(hours * visit.rateCentsPerHour),
    });
  }
  for (const trip of input.mileage ?? []) {
    if (trip.expense_id) continue;
    lines.push({
      id: trip.id,
      date: trip.trip_date,
      bucket: 'mileage',
      source: 'mileage',
      description: `Mileage · ${num(trip.miles)} mi`,
      amountCents: trip.amount_cents ?? 0,
    });
  }
  for (const tool of input.toolDays ?? []) {
    if (tool.days <= 0 || tool.dailyRateCents <= 0) continue;
    lines.push({
      id: tool.toolId,
      date: null,
      bucket: 'equipment',
      source: 'equipment',
      description: `${tool.name} · ${tool.days} ${tool.days === 1 ? 'day' : 'days'} × $${(tool.dailyRateCents / 100).toFixed(2)}`,
      amountCents: tool.days * tool.dailyRateCents,
    });
  }

  const costs = emptyCosts();
  for (const line of lines) costs[line.bucket] += line.amountCents;
  const directCostCents = lines.reduce((sum, line) => sum + line.amountCents, 0);
  const overheadPercent = Math.max(0, num(input.overheadPercent));
  const overheadCents = Math.round((directCostCents * overheadPercent) / 100);
  const totalCostCents = directCostCents + overheadCents;

  const revenueBasis: JobFinancials['revenueBasis'] =
    invoicedCents > 0 ? 'invoiced' : (input.contractCents ?? 0) > 0 ? 'contract' : 'none';
  const revenueBasisCents = revenueBasis === 'invoiced' ? invoicedCents : revenueBasis === 'contract' ? input.contractCents ?? 0 : 0;
  const grossProfitCents = revenueBasisCents - directCostCents;
  const netProfitCents = revenueBasisCents - totalCostCents;

  lines.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));

  return {
    revenue: {
      contractCents: input.contractCents,
      invoicedCents,
      collectedCents,
      outstandingCents: Math.max(0, invoicedCents - collectedCents),
      invoiceCount: billed.length,
    },
    costs,
    directCostCents,
    overheadPercent,
    overheadCents,
    totalCostCents,
    revenueBasisCents,
    revenueBasis,
    grossProfitCents,
    netProfitCents,
    grossMarginPercent: percentOf(grossProfitCents, revenueBasisCents),
    netMarginPercent: percentOf(netProfitCents, revenueBasisCents),
    laborHours: Math.round(laborHours * 100) / 100,
    lines,
  };
}

export interface ToolEventRow {
  tool_id: string;
  created_at: string;
  status?: string | null;
  project_id?: string | null;
  maintenance_plan_id?: string | null;
}

export interface ToolForDays {
  id: string;
  name: string;
  daily_rate_cents?: number | null;
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/**
 * Days each tool spent assigned to each job, from the tool's history. A job key is
 * `project:<id>` or `plan:<id>`. Every calendar day the tool was on the job counts once,
 * including the day it was assigned. Only tools with a daily rate are counted.
 */
export function toolDaysByJob(
  events: ToolEventRow[],
  tools: ToolForDays[],
  today: string,
  range?: { from: string; to: string }
): Map<string, FinToolDays[]> {
  const byTool = new Map<string, ToolEventRow[]>();
  for (const event of events) {
    const list = byTool.get(event.tool_id) ?? [];
    list.push(event);
    byTool.set(event.tool_id, list);
  }
  const result = new Map<string, FinToolDays[]>();
  for (const tool of tools) {
    const rate = tool.daily_rate_cents ?? 0;
    if (rate <= 0) continue;
    const history = (byTool.get(tool.id) ?? []).slice().sort((a, b) => a.created_at.localeCompare(b.created_at));
    const days = new Map<string, Set<string>>();
    history.forEach((event, index) => {
      const job = event.project_id ? `project:${event.project_id}` : event.maintenance_plan_id ? `plan:${event.maintenance_plan_id}` : null;
      if (!job || event.status === 'retired' || event.status === 'lost') return;
      const start = dayKey(event.created_at);
      const next = history[index + 1];
      // The day the tool moves on still counts for this job only when it moved on a later day.
      const end = next ? dayKey(next.created_at) : today;
      const last = next && end > start ? daysBetween(start, end) - 1 : daysBetween(start, end);
      for (let offset = 0; offset <= Math.max(0, last); offset += 1) {
        const date = new Date(Date.parse(`${start}T00:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10);
        if (date > today) break;
        if (range && (date < range.from || date > range.to)) continue;
        const set = days.get(job) ?? new Set<string>();
        set.add(date);
        days.set(job, set);
      }
    });
    for (const [job, set] of days) {
      const list = result.get(job) ?? [];
      list.push({ toolId: tool.id, name: tool.name, days: set.size, dailyRateCents: rate });
      result.set(job, list);
    }
  }
  return result;
}
