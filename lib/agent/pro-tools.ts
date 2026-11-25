import { createServiceRoleClient } from '@/lib/supabase/server';
import { contactDisplayName } from '@/lib/crm/contact-name';
import type { OpenAiTool } from '@/lib/agent/tools';
import type { CrmDb } from '@/lib/crm/crm-scope';

/**
 * Read-only CRM tools for a signed-in pro (the CRM owner) chatting with ProBot.
 * "Who owes me money?", "When does Daniel's project finish?", "Any maintenance on the 26th?"
 * Every query is filtered by the pro's own owner_id. Nothing here writes.
 * Dates are worked out here, in the pro's time zone, never by the model.
 */
export const PRO_TOOL_NAMES = [
  'get_open_invoices',
  'get_estimates_waiting',
  'get_projects',
  'get_maintenance_on',
  'get_day_schedule',
] as const;

export type ProToolName = (typeof PRO_TOOL_NAMES)[number];

export function isProTool(name: string): name is ProToolName {
  return (PRO_TOOL_NAMES as readonly string[]).includes(name);
}

export const DEFAULT_PRO_TIME_ZONE = 'America/Los_Angeles';

const customerParam = {
  type: 'string',
  description: 'Optional. Part of the customer\'s name, e.g. "Daniel" or "Smith". Leave out for all customers.',
};
const dayParam = {
  type: 'string',
  description:
    'The day exactly as the pro said it: "today", "tomorrow", "26", "the 26th", "monday", "Nov 26", or "2026-11-26". The server works out the date.',
};

export function proOpenAiTools(): OpenAiTool[] {
  return [
    {
      type: 'function',
      function: {
        name: 'get_open_invoices',
        description:
          'Invoices not fully paid yet (sent, partial, overdue): customer, balance still owed, due date, days late, and the total owed. Use for "who owes me money", "any invoice open", "what is overdue".',
        parameters: { type: 'object', additionalProperties: false, properties: { customer: customerParam } },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_estimates_waiting',
        description: 'Estimates sent to customers and not accepted or declined yet, with amount and days waiting.',
        parameters: { type: 'object', additionalProperties: false, properties: { customer: customerParam } },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_projects',
        description:
          'Projects with status, start date, end date (when it should finish) and days left. Use for "when does Daniel\'s project finish" or "what jobs are running". By default only planned, in progress and on hold.',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            customer: customerParam,
            includeFinished: { type: 'boolean', description: 'Also list completed and cancelled projects.' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_maintenance_on',
        description:
          'Maintenance visits due on one day (from each house\'s schedule), plus visits already logged that day. If none, also gives the next maintenance after it.',
        parameters: { type: 'object', additionalProperties: false, required: ['day'], properties: { day: dayParam } },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_day_schedule',
        description:
          'Everything on one day: appointments and meetings, maintenance due, projects running, and invoices due. Use for "what do I have tomorrow".',
        parameters: { type: 'object', additionalProperties: false, required: ['day'], properties: { day: dayParam } },
      },
    },
  ];
}

export interface ProToolResult {
  data: unknown;
  isError: boolean;
}

/* ---------- dates ---------- */

/** YYYY-MM-DD for "now" in a time zone. */
export function todayIn(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

function parseIso(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`);
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(isoDate: string, days: number): string {
  const date = parseIso(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return iso(date);
}

function daysBetween(from: string, to: string): number {
  return Math.round((parseIso(to).getTime() - parseIso(from).getTime()) / 86_400_000);
}

function weekdayName(isoDate: string): string {
  return parseIso(isoDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const WEEKDAYS_ES_PT: Record<string, number> = {
  domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6,
  segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5,
};

function validDay(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return iso(date);
}

/**
 * Turn what the pro said into a date. A bare day of the month ("the 26th") is this month
 * if it has not passed yet, otherwise next month.
 */
export function resolveDay(raw: string, today: string): string | null {
  const text = raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  if (!text) return null;
  if (/^(today|hoy|hoje)$/.test(text)) return today;
  if (/^(tomorrow|manana|amanha)$/.test(text)) return addDays(today, 1);
  if (/^(yesterday|ayer|ontem)$/.test(text)) return addDays(today, -1);

  const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) return validDay(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));

  const [year, month] = today.split('-').map(Number);
  const slash = text.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (slash) {
    const y = slash[3] ? (slash[3].length === 2 ? 2000 + Number(slash[3]) : Number(slash[3])) : year;
    const found = validDay(y, Number(slash[1]), Number(slash[2]));
    if (found && !slash[3] && found < today) return validDay(y + 1, Number(slash[1]), Number(slash[2]));
    return found;
  }

  const monthIndex = MONTHS.findIndex((name) => text.includes(name));
  const dayNumber = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (monthIndex >= 0 && dayNumber) {
    const found = validDay(year, monthIndex + 1, Number(dayNumber[1]));
    if (found && found < addDays(today, -31)) return validDay(year + 1, monthIndex + 1, Number(dayNumber[1]));
    return found;
  }
  if (dayNumber && /^(the\s+|el\s+|dia\s+|o\s+dia\s+)?\d{1,2}(st|nd|rd|th)?$/.test(text)) {
    const day = Number(dayNumber[1]);
    const thisMonth = validDay(year, month, day);
    if (thisMonth && thisMonth >= today) return thisMonth;
    return month === 12 ? validDay(year + 1, 1, day) : validDay(year, month + 1, day);
  }

  const weekdayWord = text.replace(/^(next|this|el|la|o|a|proximo|proxima)\s+/, '').replace(/-feira$/, '');
  let weekday = WEEKDAYS.indexOf(weekdayWord);
  if (weekday < 0 && weekdayWord in WEEKDAYS_ES_PT) weekday = WEEKDAYS_ES_PT[weekdayWord];
  if (weekday >= 0) {
    const current = parseIso(today).getUTCDay();
    const ahead = (weekday - current + 7) % 7 || 7;
    return addDays(today, ahead);
  }
  return null;
}

/* ---------- helpers ---------- */

/** Same "1234.00 USD" format the price guard already trusts on place records. */
function usd(cents: number | null | undefined): string | null {
  if (typeof cents !== 'number') return null;
  return `${(cents / 100).toFixed(2)} USD`;
}

interface CustomerRow {
  id: string;
  first_name: string;
  last_name: string;
  display_name: string | null;
  company_name: string | null;
}

type Db = ReturnType<typeof createServiceRoleClient>;

async function customersNamed(db: Db, ownerId: string, name: string): Promise<CustomerRow[]> {
  const words = name.replace(/[^\p{L}\p{N}\s'-]/gu, ' ').split(/\s+/).filter((word) => word.length >= 2).slice(0, 3);
  if (words.length === 0) return [];
  let query = db
    .from('pro_crm_customers')
    .select('id, first_name, last_name, display_name, company_name')
    .eq('owner_id', ownerId);
  for (const word of words) {
    const like = `%${word}%`;
    query = query.or(`first_name.ilike.${like},last_name.ilike.${like},display_name.ilike.${like},company_name.ilike.${like}`);
  }
  const { data } = await query.limit(10);
  return (data ?? []) as CustomerRow[];
}

async function customerNames(db: Db, ownerId: string, ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const { data } = await db
    .from('pro_crm_customers')
    .select('id, first_name, last_name, display_name, company_name')
    .eq('owner_id', ownerId)
    .in('id', unique);
  return new Map(((data ?? []) as CustomerRow[]).map((row) => [row.id, contactDisplayName(row)]));
}

/** Filter ids for an optional customer name. null = no filter; [] = nobody matched. */
async function customerFilter(db: Db, ownerId: string, customer: unknown): Promise<{ ids: string[] | null; matched: string[] }> {
  if (typeof customer !== 'string' || !customer.trim()) return { ids: null, matched: [] };
  const rows = await customersNamed(db, ownerId, customer);
  return { ids: rows.map((row) => row.id), matched: rows.map((row) => contactDisplayName(row)) };
}

const FREQUENCY_DAYS: Record<string, number> = { weekly: 7, biweekly: 14 };
const FREQUENCY_MONTHS: Record<string, number> = { monthly: 1, quarterly: 3, yearly: 12 };

function addMonths(isoDate: string, months: number): string {
  const date = parseIso(isoDate);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 12)).getUTCDate();
  date.setUTCDate(Math.min(day, last));
  return iso(date);
}

/** Planned visit dates from next_visit_date, stepping by the plan's frequency, through `until`. */
export function planVisitDates(next: string, frequency: string, until: string, endDate: string | null): string[] {
  const dates: string[] = [];
  let current = next;
  for (let guard = 0; guard < 400 && current <= until; guard += 1) {
    if (endDate && current > endDate) break;
    dates.push(current);
    if (FREQUENCY_DAYS[frequency]) current = addDays(current, FREQUENCY_DAYS[frequency]);
    else if (FREQUENCY_MONTHS[frequency]) current = addMonths(next, FREQUENCY_MONTHS[frequency] * (dates.length));
    else break;
  }
  return dates;
}

interface PlanRow {
  id: string;
  customer_id: string;
  name: string;
  frequency: string;
  next_visit_date: string | null;
  end_date: string | null;
  scope_of_work: string | null;
}

async function maintenanceDue(db: Db, ownerId: string, day: string) {
  const { data } = await db
    .from('pro_crm_maintenance_plans')
    .select('id, customer_id, name, frequency, next_visit_date, end_date, scope_of_work')
    .eq('owner_id', ownerId)
    .eq('is_active', true)
    .not('next_visit_date', 'is', null)
    .lte('next_visit_date', day);
  const plans = ((data ?? []) as PlanRow[]).filter((plan) => planVisitDates(plan.next_visit_date!, plan.frequency, day, plan.end_date).includes(day));
  return plans;
}

async function nextMaintenanceAfter(db: Db, ownerId: string, day: string) {
  const { data } = await db
    .from('pro_crm_maintenance_plans')
    .select('id, customer_id, name, frequency, next_visit_date, end_date, scope_of_work')
    .eq('owner_id', ownerId)
    .eq('is_active', true)
    .not('next_visit_date', 'is', null)
    .limit(300);
  const horizon = addDays(day, 120);
  let best: { date: string; plan: PlanRow } | null = null;
  for (const plan of (data ?? []) as PlanRow[]) {
    const date = planVisitDates(plan.next_visit_date!, plan.frequency, horizon, plan.end_date).find((value) => value > day);
    if (date && (!best || date < best.date)) best = { date, plan };
  }
  return best;
}

interface VisitRow {
  id: string;
  customer_id: string;
  maintenance_plan_id: string | null;
  status: string;
  started_at: string;
}

function dayRangeUtc(day: string): { from: string; to: string } {
  // Wide window, then keep only rows whose local date is the day.
  return { from: `${addDays(day, -1)}T00:00:00Z`, to: `${addDays(day, 2)}T00:00:00Z` };
}

function localDate(isoTime: string, timeZone: string): string {
  return todayIn(timeZone, new Date(isoTime));
}

function localTime(isoTime: string, timeZone: string): string {
  return new Date(isoTime).toLocaleTimeString('en-US', { timeZone, hour: 'numeric', minute: '2-digit' });
}

/* ---------- tools ---------- */

export interface ProToolContext {
  userId: string;
  timeZone: string;
}

export async function runProTool(name: ProToolName, args: Record<string, unknown>, context: ProToolContext): Promise<ProToolResult> {
  const db = createServiceRoleClient();
  const ownerId = context.userId;
  const today = todayIn(context.timeZone);

  try {
    if (name === 'get_open_invoices') {
      const filter = await customerFilter(db, ownerId, args.customer);
      if (filter.ids && filter.ids.length === 0) return { data: { today, error: `No customer matches "${String(args.customer)}".` }, isError: false };
      let query = db
        .from('pro_crm_invoices')
        .select('id, display_id, invoice_number, customer_id, amount_cents, payment_applied_cents, status, due_date')
        .eq('owner_id', ownerId)
        .in('status', ['sent', 'partial', 'overdue'])
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(50);
      if (filter.ids) query = query.in('customer_id', filter.ids);
      const { data, error } = await query;
      if (error) return { data: { error: error.message }, isError: true };
      const rows = (data ?? []).map((row) => ({ ...row, balance: Math.max(0, row.amount_cents - (row.payment_applied_cents ?? 0)) }))
        .filter((row) => row.balance > 0);
      const names = await customerNames(db, ownerId, rows.map((row) => row.customer_id));
      const total = rows.reduce((sum, row) => sum + row.balance, 0);
      return {
        data: {
          today,
          count: rows.length,
          totalOwed: usd(total),
          invoices: rows.slice(0, 15).map((row) => ({
            number: row.invoice_number || row.display_id,
            customer: names.get(row.customer_id) ?? 'Unknown customer',
            balance: usd(row.balance),
            invoiceTotal: usd(row.amount_cents),
            dueDate: row.due_date,
            daysLate: row.due_date && row.due_date < today ? daysBetween(row.due_date, today) : 0,
            status: row.status,
          })),
          more: Math.max(0, rows.length - 15),
        },
        isError: false,
      };
    }

    if (name === 'get_estimates_waiting') {
      const filter = await customerFilter(db, ownerId, args.customer);
      if (filter.ids && filter.ids.length === 0) return { data: { today, error: `No customer matches "${String(args.customer)}".` }, isError: false };
      let query = db
        .from('pro_crm_estimates')
        .select('id, display_id, customer_id, amount_cents, job_area, due_date, updated_at')
        .eq('owner_id', ownerId)
        .eq('status', 'sent')
        .order('updated_at', { ascending: true })
        .limit(30);
      if (filter.ids) query = query.in('customer_id', filter.ids);
      const { data, error } = await query;
      if (error) return { data: { error: error.message }, isError: true };
      const names = await customerNames(db, ownerId, (data ?? []).map((row) => row.customer_id));
      return {
        data: {
          today,
          count: (data ?? []).length,
          estimates: (data ?? []).slice(0, 15).map((row) => ({
            number: row.display_id,
            customer: names.get(row.customer_id) ?? 'Unknown customer',
            amount: usd(row.amount_cents),
            area: row.job_area,
            validUntil: row.due_date,
            sentDaysAgo: daysBetween(localDate(row.updated_at, context.timeZone), today),
          })),
        },
        isError: false,
      };
    }

    if (name === 'get_projects') {
      const filter = await customerFilter(db, ownerId, args.customer);
      if (filter.ids && filter.ids.length === 0) return { data: { today, error: `No customer matches "${String(args.customer)}".` }, isError: false };
      let query = db
        .from('pro_crm_projects')
        .select('id, display_id, customer_id, name, status, start_date, end_date')
        .eq('owner_id', ownerId)
        .order('end_date', { ascending: true, nullsFirst: false })
        .limit(30);
      if (args.includeFinished !== true) query = query.in('status', ['planned', 'in_progress', 'on_hold']);
      if (filter.ids) query = query.in('customer_id', filter.ids);
      const { data, error } = await query;
      if (error) return { data: { error: error.message }, isError: true };
      const names = await customerNames(db, ownerId, (data ?? []).map((row) => row.customer_id));
      const customersFound = [...new Set((data ?? []).map((row) => names.get(row.customer_id)).filter(Boolean))];
      return {
        data: {
          today,
          ...(filter.ids && customersFound.length > 1
            ? { note: `Several customers match "${String(args.customer)}": ${customersFound.join(', ')}. Ask which one if it matters.` }
            : {}),
          projects: (data ?? []).map((row) => ({
            name: row.name,
            customer: names.get(row.customer_id) ?? 'Unknown customer',
            status: row.status,
            start: row.start_date,
            finish: row.end_date,
            daysLeft: row.end_date ? daysBetween(today, row.end_date) : null,
            finishNote: row.end_date ? null : 'No end date set on this project.',
          })),
        },
        isError: false,
      };
    }

    const rawDay = typeof args.day === 'string' ? args.day : '';
    const day = resolveDay(rawDay, today);
    if (!day) {
      return { data: { today, error: `Could not tell which day "${rawDay}" is. Ask the pro for the date.` }, isError: false };
    }
    const dayInfo = { today, day, dayName: weekdayName(day), relative: day === today ? 'today' : day === addDays(today, 1) ? 'tomorrow' : null };

    const due = await maintenanceDue(db, ownerId, day);
    const { from, to } = dayRangeUtc(day);
    // Table added in 138_maintenance_visits; not in the generated types yet.
    const { data: visitRows } = await (db as unknown as CrmDb)
      .from('pro_crm_maintenance_visits')
      .select('id, customer_id, maintenance_plan_id, status, started_at')
      .eq('owner_id', ownerId)
      .gte('started_at', from)
      .lt('started_at', to)
      .neq('status', 'cancelled');
    const visits = ((visitRows ?? []) as VisitRow[]).filter((row) => localDate(row.started_at, context.timeZone) === day);

    if (name === 'get_maintenance_on') {
      const names = await customerNames(db, ownerId, [...due.map((plan) => plan.customer_id), ...visits.map((row) => row.customer_id)]);
      const next = due.length === 0 && visits.length === 0 ? await nextMaintenanceAfter(db, ownerId, day) : null;
      const nextName = next ? (await customerNames(db, ownerId, [next.plan.customer_id])).get(next.plan.customer_id) : null;
      return {
        data: {
          ...dayInfo,
          due: due.map((plan) => ({
            customer: names.get(plan.customer_id) ?? 'Unknown customer',
            plan: plan.name,
            frequency: plan.frequency,
            work: plan.scope_of_work?.slice(0, 160) ?? null,
          })),
          logged: visits.map((row) => ({
            customer: names.get(row.customer_id) ?? 'Unknown customer',
            status: row.status,
            started: localTime(row.started_at, context.timeZone),
          })),
          next: next ? { date: next.date, dayName: weekdayName(next.date), customer: nextName ?? 'Unknown customer', plan: next.plan.name } : null,
        },
        isError: false,
      };
    }

    // get_day_schedule
    const [tasks, projects, invoices] = await Promise.all([
      db
        .from('pro_crm_tasks')
        .select('id, task_type, other_label, customer_id, meeting_with, start_at, end_at')
        .eq('owner_id', ownerId)
        .gte('start_at', from)
        .lt('start_at', to)
        .order('start_at'),
      db
        .from('pro_crm_projects')
        .select('id, customer_id, name, status, start_date, end_date')
        .eq('owner_id', ownerId)
        .in('status', ['planned', 'in_progress'])
        .lte('start_date', day)
        .or(`end_date.is.null,end_date.gte.${day}`)
        .limit(20),
      db
        .from('pro_crm_invoices')
        .select('id, invoice_number, display_id, customer_id, amount_cents, payment_applied_cents, status')
        .eq('owner_id', ownerId)
        .in('status', ['sent', 'partial', 'overdue'])
        .eq('due_date', day),
    ]);
    const dayTasks = (tasks.data ?? []).filter((row) => localDate(row.start_at, context.timeZone) === day);
    const names = await customerNames(db, ownerId, [
      ...due.map((plan) => plan.customer_id),
      ...visits.map((row) => row.customer_id),
      ...dayTasks.map((row) => row.customer_id ?? ''),
      ...(projects.data ?? []).map((row) => row.customer_id),
      ...(invoices.data ?? []).map((row) => row.customer_id),
    ]);
    const taskLabel: Record<string, string> = {
      estimate_appointment: 'Estimate appointment',
      business_meeting: 'Meeting',
      follow_up: 'Follow-up',
    };
    return {
      data: {
        ...dayInfo,
        appointments: dayTasks.map((row) => ({
          time: localTime(row.start_at, context.timeZone),
          until: localTime(row.end_at, context.timeZone),
          what: taskLabel[row.task_type] ?? row.other_label ?? 'Appointment',
          with: (row.customer_id ? names.get(row.customer_id) : null) ?? row.meeting_with ?? null,
        })),
        maintenance: due.map((plan) => ({ customer: names.get(plan.customer_id) ?? 'Unknown customer', plan: plan.name })),
        maintenanceLogged: visits.length,
        projectsRunning: (projects.data ?? []).map((row) => ({
          name: row.name,
          customer: names.get(row.customer_id) ?? 'Unknown customer',
          finish: row.end_date,
        })),
        invoicesDue: (invoices.data ?? []).map((row) => ({
          number: row.invoice_number || row.display_id,
          customer: names.get(row.customer_id) ?? 'Unknown customer',
          balance: usd(Math.max(0, row.amount_cents - (row.payment_applied_cents ?? 0))),
        })),
      },
      isError: false,
    };
  } catch (error) {
    return { data: { error: error instanceof Error ? error.message : 'Could not read the CRM' }, isError: true };
  }
}
