import type { CrmDb } from '@/lib/crm/crm-scope';
import {
  buildJobFinancials,
  isOverheadCategory,
  toolDaysByJob,
  type FinExpense,
  type FinInvoice,
  type FinMileage,
  type FinTimeEntry,
  type FinToolDays,
  type FinVisitLabor,
  type JobFinancials,
} from '@/lib/crm/job-financials';

/** A job is a project or a maintenance plan. Keys look like `project:<id>` or `plan:<id>`. */
export type JobKind = 'project' | 'plan';
export type JobKey = `${JobKind}:${string}`;

export interface JobInfo {
  key: JobKey;
  kind: JobKind;
  id: string;
  name: string;
  status: string;
  customerId: string | null;
  estimateId: string | null;
  contractCents: number | null;
  startDate: string | null;
  endDate: string | null;
}

export interface CostingSettings {
  overheadPercent: number;
  defaultLaborCentsPerHour: number;
}

export interface DateRange {
  from: string;
  to: string;
}

type Row = Record<string, unknown>;

function str(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

function n(value: unknown): number {
  const parsed = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Rows from a query, or [] when the table or a column is not there yet (migration not applied). */
async function rows(query: PromiseLike<{ data: unknown; error: { message?: string } | null }>): Promise<Row[]> {
  const { data, error } = await query;
  if (error) return [];
  return (data as Row[] | null) ?? [];
}

function inRange(date: string | null, range?: DateRange): boolean {
  if (!range) return true;
  if (!date) return false;
  const day = date.slice(0, 10);
  return day >= range.from && day <= range.to;
}

export async function loadCostingSettings(db: CrmDb, ownerId: string): Promise<CostingSettings> {
  const { data } = await db.from('pro_invoice_settings').select('*').eq('owner_id', ownerId).maybeSingle();
  const row = (data ?? {}) as Row;
  return {
    overheadPercent: Math.max(0, n(row.overhead_percent)),
    defaultLaborCentsPerHour: Math.max(0, n(row.default_labor_cost_cents_per_hour)),
  };
}

/** Everything that feeds the financials, for one owner, grouped by job. */
export interface OwnerJobData {
  settings: CostingSettings;
  jobs: Map<JobKey, JobInfo>;
  invoices: Map<JobKey, FinInvoice[]>;
  expenses: Map<JobKey, FinExpense[]>;
  time: Map<JobKey, FinTimeEntry[]>;
  visits: Map<JobKey, FinVisitLabor[]>;
  mileage: Map<JobKey, FinMileage[]>;
  tools: Map<string, FinToolDays[]>;
  /** Money not tied to any job: overhead and job costs nobody linked yet. */
  unassigned: {
    invoices: FinInvoice[];
    expenses: FinExpense[];
    mileage: FinMileage[];
  };
}

function push<T>(map: Map<JobKey, T[]>, key: JobKey, item: T) {
  const list = map.get(key) ?? [];
  list.push(item);
  map.set(key, list);
}

function jobKeyOf(row: Row): JobKey | null {
  const project = str(row.project_id);
  if (project) return `project:${project}`;
  const plan = str(row.maintenance_plan_id);
  return plan ? `plan:${plan}` : null;
}

/**
 * Load one owner's projects, plans, and every money row linked to them. With a range, only
 * rows dated inside it count (for the P&L); without one, everything (for a job's report).
 * `only` limits the work to one job.
 */
export async function loadOwnerJobData(
  db: CrmDb,
  ownerId: string,
  options: { range?: DateRange; only?: JobKey; today: string }
): Promise<OwnerJobData> {
  const { range, only, today } = options;
  const onlyKind = only?.split(':')[0] as JobKind | undefined;
  const onlyId = only?.split(':')[1];

  let projectsQuery = db
    .from('pro_crm_projects')
    .select('id, name, status, customer_id, estimate_id, start_date, end_date')
    .eq('owner_id', ownerId);
  if (onlyKind === 'project') projectsQuery = projectsQuery.eq('id', onlyId);
  let plansQuery = db
    .from('pro_crm_maintenance_plans')
    .select('id, name, is_active, customer_id, source_estimate_id, amount_cents, frequency')
    .eq('owner_id', ownerId);
  if (onlyKind === 'plan') plansQuery = plansQuery.eq('id', onlyId);

  const [projects, plans, settings] = await Promise.all([
    onlyKind === 'plan' ? Promise.resolve([]) : rows(projectsQuery.limit(2000)),
    onlyKind === 'project' ? Promise.resolve([]) : rows(plansQuery.limit(2000)),
    loadCostingSettings(db, ownerId),
  ]);

  const estimateIds = [
    ...projects.map((p) => str(p.estimate_id)),
    ...plans.map((p) => str(p.source_estimate_id)),
  ].filter((id): id is string => Boolean(id));
  const estimates = estimateIds.length
    ? await rows(db.from('pro_crm_estimates').select('id, amount_cents').in('id', estimateIds))
    : [];
  const estimateTotal = new Map(estimates.map((e) => [String(e.id), n(e.amount_cents)]));

  const jobs = new Map<JobKey, JobInfo>();
  const byEstimate = new Map<string, JobKey>();
  for (const p of projects) {
    const key: JobKey = `project:${String(p.id)}`;
    const estimateId = str(p.estimate_id);
    jobs.set(key, {
      key,
      kind: 'project',
      id: String(p.id),
      name: str(p.name) ?? 'Project',
      status: str(p.status) ?? 'planned',
      customerId: str(p.customer_id),
      estimateId,
      contractCents: estimateId ? estimateTotal.get(estimateId) ?? null : null,
      startDate: str(p.start_date),
      endDate: str(p.end_date),
    });
    if (estimateId) byEstimate.set(estimateId, key);
  }
  for (const p of plans) {
    const key: JobKey = `plan:${String(p.id)}`;
    const estimateId = str(p.source_estimate_id);
    jobs.set(key, {
      key,
      kind: 'plan',
      id: String(p.id),
      name: str(p.name) ?? 'Maintenance plan',
      status: p.is_active === false ? 'inactive' : 'active',
      customerId: str(p.customer_id),
      estimateId,
      contractCents: null,
      startDate: null,
      endDate: null,
    });
    if (estimateId && !byEstimate.has(estimateId)) byEstimate.set(estimateId, key);
  }

  // Rows for one job, or every row of the owner.
  const scoped = (table: string, select: string) => {
    let query = db.from(table).select(select).eq('owner_id', ownerId);
    if (onlyKind && onlyId) query = query.eq(onlyKind === 'project' ? 'project_id' : 'maintenance_plan_id', onlyId);
    return query.limit(10000);
  };
  const invoiceSelect = 'id, invoice_number, invoice_date, amount_cents, payment_applied_cents, status, estimate_id';

  const [invoicesLinked, invoicesByEstimate, expenses, time, visits, mileage, tools] = await Promise.all([
    // Fails before migration 167 (no project_id): then invoices come through their estimate.
    rows(scoped('pro_crm_invoices', `${invoiceSelect}, project_id, maintenance_plan_id`)),
    only
      ? (() => {
          const job = jobs.get(only);
          return job?.estimateId
            ? rows(db.from('pro_crm_invoices').select(invoiceSelect).eq('owner_id', ownerId).eq('estimate_id', job.estimateId))
            : Promise.resolve([] as Row[]);
        })()
      : rows(db.from('pro_crm_invoices').select(invoiceSelect).eq('owner_id', ownerId).limit(10000)),
    onlyKind === 'plan'
      ? rows(scoped('pro_crm_expenses', 'id, amount_cents, category, expense_date, description, note, project_id, maintenance_plan_id'))
      : rows(
          (() => {
            let query = db.from('pro_crm_expenses').select('*').eq('owner_id', ownerId);
            if (onlyKind === 'project') query = query.eq('project_id', onlyId);
            return query.limit(10000);
          })()
        ),
    rows(scoped('pro_crm_time_entries', 'id, work_date, hours, rate_cents_per_hour, person_name, note, project_id, maintenance_plan_id')),
    rows(scoped('pro_crm_maintenance_visits', 'id, started_at, status, duration_seconds, worker_count, labor_seconds, project_id, maintenance_plan_id')),
    rows(
      (() => {
        let query = db.from('pro_crm_mileage_trips').select('*').eq('owner_id', ownerId);
        if (onlyKind && onlyId) query = query.eq(onlyKind === 'project' ? 'project_id' : 'maintenance_plan_id', onlyId);
        return query.limit(10000);
      })()
    ),
    rows(db.from('pro_crm_tools').select('*').eq('owner_id', ownerId).gt('daily_rate_cents', 0).limit(2000)),
  ]);

  const data: OwnerJobData = {
    settings,
    jobs,
    invoices: new Map(),
    expenses: new Map(),
    time: new Map(),
    visits: new Map(),
    mileage: new Map(),
    tools: new Map(),
    unassigned: { invoices: [], expenses: [], mileage: [] },
  };

  // Invoices: linked directly, or through the job's estimate. Each invoice once.
  const seen = new Set<string>();
  for (const row of [...invoicesLinked, ...invoicesByEstimate]) {
    const id = String(row.id);
    if (seen.has(id)) continue;
    const date = str(row.invoice_date);
    if (!inRange(date, range)) continue;
    const invoice: FinInvoice = {
      id,
      invoice_number: str(row.invoice_number),
      invoice_date: date,
      amount_cents: n(row.amount_cents),
      payment_applied_cents: n(row.payment_applied_cents),
      status: str(row.status) ?? 'draft',
    };
    const estimateId = str(row.estimate_id);
    const key = jobKeyOf(row) ?? (estimateId ? byEstimate.get(estimateId) ?? null : null);
    if (only && key !== only) continue;
    seen.add(id);
    if (key && jobs.has(key)) push(data.invoices, key, invoice);
    else data.unassigned.invoices.push(invoice);
  }

  for (const row of expenses) {
    const date = str(row.expense_date);
    if (!inRange(date, range)) continue;
    const expense: FinExpense = {
      id: String(row.id),
      amount_cents: n(row.amount_cents),
      category: str(row.category) ?? 'Other',
      expense_date: date ?? '',
      description: str(row.description),
      note: str(row.note),
    };
    const key = jobKeyOf(row);
    if (key && jobs.has(key)) push(data.expenses, key, expense);
    else if (!only) data.unassigned.expenses.push(expense);
  }

  for (const row of time) {
    const date = str(row.work_date);
    const key = jobKeyOf(row);
    if (!key || !inRange(date, range)) continue;
    push(data.time, key, {
      id: String(row.id),
      work_date: date ?? '',
      hours: n(row.hours),
      rate_cents_per_hour: n(row.rate_cents_per_hour),
      person_name: str(row.person_name),
      note: str(row.note),
    });
  }

  for (const row of visits) {
    if (row.status === 'cancelled') continue;
    const date = str(row.started_at)?.slice(0, 10) ?? null;
    const key = jobKeyOf(row);
    if (!key || !inRange(date, range)) continue;
    const labor = row.labor_seconds != null ? n(row.labor_seconds) : n(row.duration_seconds) * Math.max(1, n(row.worker_count));
    push(data.visits, key, {
      id: String(row.id),
      date: date ?? '',
      laborSeconds: labor,
      rateCentsPerHour: settings.defaultLaborCentsPerHour,
    });
  }

  for (const row of mileage) {
    const date = str(row.trip_date);
    if (!inRange(date, range)) continue;
    const trip: FinMileage = {
      id: String(row.id),
      trip_date: date ?? '',
      amount_cents: n(row.amount_cents),
      miles: n(row.miles),
      expense_id: str(row.expense_id),
    };
    const key = jobKeyOf(row);
    if (key && jobs.has(key)) push(data.mileage, key, trip);
    else if (!only) data.unassigned.mileage.push(trip);
  }

  if (tools.length > 0) {
    const toolIds = tools.map((tool) => String(tool.id));
    const events = await rows(
      db
        .from('pro_crm_tool_events')
        .select('tool_id, created_at, status, project_id, maintenance_plan_id')
        .eq('owner_id', ownerId)
        .in('tool_id', toolIds)
        .order('created_at', { ascending: true })
        .limit(20000)
    );
    data.tools = toolDaysByJob(
      events.map((event) => ({
        tool_id: String(event.tool_id),
        created_at: String(event.created_at),
        status: str(event.status),
        project_id: str(event.project_id),
        maintenance_plan_id: str(event.maintenance_plan_id),
      })),
      tools.map((tool) => ({ id: String(tool.id), name: str(tool.name) ?? 'Equipment', daily_rate_cents: n(tool.daily_rate_cents) })),
      today,
      range
    );
  }

  return data;
}

/** The financial report of one job from loaded data. */
export function jobFinancialsFrom(data: OwnerJobData, key: JobKey): JobFinancials {
  const job = data.jobs.get(key);
  return buildJobFinancials({
    contractCents: job?.contractCents ?? null,
    invoices: data.invoices.get(key) ?? [],
    expenses: data.expenses.get(key) ?? [],
    timeEntries: data.time.get(key) ?? [],
    visitLabor: data.visits.get(key) ?? [],
    mileage: data.mileage.get(key) ?? [],
    toolDays: data.tools.get(key) ?? [],
    overheadPercent: data.settings.overheadPercent,
  });
}

export interface ProfitAndLoss {
  range: DateRange;
  revenue: { invoicedCents: number; collectedCents: number; outstandingCents: number };
  /** Direct costs on jobs, by bucket, plus job-type expenses nobody linked to a job. */
  directCosts: Record<string, number>;
  directCostCents: number;
  unlinkedJobCostCents: number;
  overhead: Array<{ category: string; amountCents: number }>;
  overheadCents: number;
  grossProfitCents: number;
  netProfitCents: number;
  grossMarginPercent: number | null;
  netMarginPercent: number | null;
  /** Real overhead ÷ direct cost, to compare with the % the pro set. */
  actualOverheadPercent: number | null;
  setOverheadPercent: number;
  jobs: Array<{
    key: JobKey;
    kind: JobKind;
    id: string;
    name: string;
    status: string;
    invoicedCents: number;
    collectedCents: number;
    directCostCents: number;
    overheadCents: number;
    netProfitCents: number;
    netMarginPercent: number | null;
  }>;
}

function pct(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;
}

/** Whole-business profit and loss for a date range. */
export function profitAndLoss(data: OwnerJobData, range: DateRange): ProfitAndLoss {
  const directCosts: Record<string, number> = {};
  let directCostCents = 0;
  let invoicedCents = 0;
  let collectedCents = 0;
  const jobs: ProfitAndLoss['jobs'] = [];

  for (const job of data.jobs.values()) {
    const fin = jobFinancialsFrom(data, job.key);
    const active =
      fin.revenue.invoiceCount > 0 || fin.directCostCents > 0;
    if (!active) continue;
    for (const [bucket, cents] of Object.entries(fin.costs)) directCosts[bucket] = (directCosts[bucket] ?? 0) + cents;
    directCostCents += fin.directCostCents;
    invoicedCents += fin.revenue.invoicedCents;
    collectedCents += fin.revenue.collectedCents;
    jobs.push({
      key: job.key,
      kind: job.kind,
      id: job.id,
      name: job.name,
      status: job.status,
      invoicedCents: fin.revenue.invoicedCents,
      collectedCents: fin.revenue.collectedCents,
      directCostCents: fin.directCostCents,
      overheadCents: fin.overheadCents,
      netProfitCents: fin.revenue.invoicedCents - fin.totalCostCents,
      netMarginPercent: pct(fin.revenue.invoicedCents - fin.totalCostCents, fin.revenue.invoicedCents),
    });
  }

  // Money not linked to a job.
  const unassignedFin = buildJobFinancials({
    contractCents: null,
    invoices: data.unassigned.invoices,
    expenses: data.unassigned.expenses.filter((expense) => !isOverheadCategory(expense.category)),
    overheadPercent: 0,
  });
  invoicedCents += unassignedFin.revenue.invoicedCents;
  collectedCents += unassignedFin.revenue.collectedCents;
  const unlinkedJobCostCents = unassignedFin.directCostCents;
  for (const [bucket, cents] of Object.entries(unassignedFin.costs)) directCosts[bucket] = (directCosts[bucket] ?? 0) + cents;
  directCostCents += unlinkedJobCostCents;

  const overheadByCategory = new Map<string, number>();
  for (const expense of data.unassigned.expenses) {
    if (!isOverheadCategory(expense.category)) continue;
    overheadByCategory.set(expense.category, (overheadByCategory.get(expense.category) ?? 0) + expense.amount_cents);
  }
  const unlinkedMileage = data.unassigned.mileage.filter((trip) => !trip.expense_id).reduce((sum, trip) => sum + trip.amount_cents, 0);
  if (unlinkedMileage > 0) overheadByCategory.set('Mileage', (overheadByCategory.get('Mileage') ?? 0) + unlinkedMileage);
  const overhead = [...overheadByCategory.entries()]
    .map(([category, amountCents]) => ({ category, amountCents }))
    .sort((a, b) => b.amountCents - a.amountCents);
  const overheadCents = overhead.reduce((sum, item) => sum + item.amountCents, 0);

  const grossProfitCents = invoicedCents - directCostCents;
  const netProfitCents = grossProfitCents - overheadCents;
  jobs.sort((a, b) => b.invoicedCents - a.invoicedCents);

  return {
    range,
    revenue: { invoicedCents, collectedCents, outstandingCents: Math.max(0, invoicedCents - collectedCents) },
    directCosts,
    directCostCents,
    unlinkedJobCostCents,
    overhead,
    overheadCents,
    grossProfitCents,
    netProfitCents,
    grossMarginPercent: pct(grossProfitCents, invoicedCents),
    netMarginPercent: pct(netProfitCents, invoicedCents),
    actualOverheadPercent: pct(overheadCents, directCostCents),
    setOverheadPercent: data.settings.overheadPercent,
    jobs,
  };
}
