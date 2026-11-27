/**
 * ProBot actions for a signed-in pro: send an invoice reminder, mark an invoice paid, schedule a
 * visit, log hours. ProBot only PREPARES them (read-only lookups here); the pro sees a Confirm card
 * and the card calls the normal CRM API with the pro's own session, so the same auth and checks run.
 */
import { createServiceRoleClient } from '@/lib/supabase/server';
import { contactDisplayName } from '@/lib/crm/contact-name';
import { PAYMENT_METHODS } from '@/lib/crm/invoice-books';
import type { OpenAiTool } from '@/lib/agent/tools';
import { customersNamed, resolveDay, todayIn, usd } from '@/lib/agent/pro-tools';
import type { ChatProAction } from '@/lib/types/chat';

export const PRO_ACTION_NAMES = ['remind_invoice', 'mark_invoice_paid', 'schedule_visit', 'log_hours'] as const;
export type ProActionName = (typeof PRO_ACTION_NAMES)[number];

export function isProActionTool(name: string): name is ProActionName {
  return (PRO_ACTION_NAMES as readonly string[]).includes(name);
}

const invoiceParams = {
  invoice: { type: 'string', description: 'The invoice number if the pro said one, e.g. "INV-1042".' },
  customer: { type: 'string', description: 'Part of a customer name they just said.' },
};

export function proActionOpenAiTools(): OpenAiTool[] {
  return [
    {
      type: 'function',
      function: {
        name: 'remind_invoice',
        description: 'Prepare a payment reminder email for an open invoice. The pro must tap Confirm; nothing is sent until then.',
        parameters: { type: 'object', additionalProperties: false, properties: invoiceParams },
      },
    },
    {
      type: 'function',
      function: {
        name: 'mark_invoice_paid',
        description:
          'Prepare recording a payment the pro received (cash, check, transfer…) on an open invoice. Leave amount out for the full balance. The pro must tap Confirm.',
        parameters: {
          type: 'object',
          additionalProperties: false,
          properties: {
            ...invoiceParams,
            amount: { type: 'number', description: 'Dollars received, only if the pro said an amount.' },
            method: { type: 'string', enum: [...PAYMENT_METHODS] },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'schedule_visit',
        description: 'Prepare a calendar event: an estimate visit, follow-up or meeting. The pro must tap Confirm.',
        parameters: {
          type: 'object',
          additionalProperties: false,
          required: ['day', 'time'],
          properties: {
            kind: { type: 'string', enum: ['estimate_appointment', 'follow_up', 'business_meeting', 'other'] },
            customer: invoiceParams.customer,
            day: { type: 'string', description: 'The day as the pro said it ("tomorrow", "friday", "the 26th").' },
            time: { type: 'string', description: '24-hour start time, e.g. "09:00" or "14:30".' },
            minutes: { type: 'number', description: 'Length in minutes, default 60.' },
            note: { type: 'string' },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'log_hours',
        description: 'Prepare logging hours worked on a project. The pro must tap Confirm.',
        parameters: {
          type: 'object',
          additionalProperties: false,
          required: ['hours'],
          properties: {
            hours: { type: 'number' },
            project: { type: 'string', description: 'Part of the project name.' },
            customer: invoiceParams.customer,
            person: { type: 'string', description: 'Who worked, if not the pro.' },
            day: { type: 'string', description: 'Default today.' },
            note: { type: 'string' },
          },
        },
      },
    },
  ];
}

type Prepared = { action: ChatProAction } | { error: string };

const text = (value: unknown, max = 200) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

/** A wall-clock time in the pro's time zone as an ISO instant. */
export function zonedIso(day: string, time: string, timeZone: string): string | null {
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) return null;
  const [y, m, d] = day.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, Number(match[1]), Number(match[2]));
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(guess));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const shown = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  return new Date(guess - (shown - guess)).toISOString();
}

type Db = ReturnType<typeof createServiceRoleClient>;

async function findInvoice(db: Db, ownerId: string, args: Record<string, unknown>) {
  const number = text(args.invoice, 40).replace(/[^\w-]/g, '');
  const customer = text(args.customer, 80);
  if (!number && !customer) return { error: 'Ask which invoice or customer.' };
  let query = db
    .from('pro_crm_invoices')
    .select('id, display_id, invoice_number, customer_id, amount_cents, payment_applied_cents, due_date')
    .eq('owner_id', ownerId)
    .in('status', ['sent', 'partial', 'overdue'])
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(10);
  if (number) query = query.or(`invoice_number.ilike.%${number}%,display_id.ilike.%${number}%`);
  const names = new Map<string, string>();
  if (customer) {
    const rows = await customersNamed(db, ownerId, customer);
    if (rows.length === 0) return { error: `No customer matches "${customer}".` };
    for (const row of rows) names.set(row.id, contactDisplayName(row));
    query = query.in('customer_id', [...names.keys()]);
  }
  const { data } = await query;
  const open = (data ?? []).filter((row) => row.amount_cents - (row.payment_applied_cents ?? 0) > 0);
  if (open.length === 0) return { error: 'No open invoice matches. Nothing was prepared.' };
  if (open.length > 1) {
    return { error: `Several open invoices match (${open.map((row) => row.invoice_number || row.display_id).join(', ')}). Ask which one.` };
  }
  const invoice = open[0];
  if (!names.has(invoice.customer_id)) {
    const { data: row } = await db
      .from('pro_crm_customers')
      .select('id, first_name, last_name, display_name, company_name')
      .eq('id', invoice.customer_id)
      .maybeSingle();
    if (row) names.set(row.id, contactDisplayName(row));
  }
  return {
    id: invoice.id,
    label: invoice.invoice_number || invoice.display_id || 'Invoice',
    customer: names.get(invoice.customer_id) ?? 'Customer',
    balance: invoice.amount_cents - (invoice.payment_applied_cents ?? 0),
  };
}

export async function prepareProAction(
  name: ProActionName,
  args: Record<string, unknown>,
  context: { userId: string; timeZone: string }
): Promise<Prepared> {
  const db = createServiceRoleClient();
  const today = todayIn(context.timeZone);

  if (name === 'remind_invoice' || name === 'mark_invoice_paid') {
    const found = await findInvoice(db, context.userId, args);
    if ('error' in found) return { error: found.error ?? 'No open invoice matches.' };
    if (name === 'remind_invoice') {
      return {
        action: {
          kind: name,
          title: 'Send payment reminder?',
          lines: [`${found.label} · ${found.customer}`, `Balance ${usd(found.balance)}`, 'Emails the customer with the pay link.'],
          url: `/api/crm/invoices/${found.id}/reminder`,
          body: {},
          openUrl: `/crm/invoices/${found.id}`,
        },
      };
    }
    const asked = typeof args.amount === 'number' && args.amount > 0 ? Math.round(args.amount * 100) : found.balance;
    if (asked > found.balance) return { error: `That is more than the balance (${usd(found.balance)}). Ask again.` };
    const method = (PAYMENT_METHODS as readonly string[]).includes(String(args.method)) ? String(args.method) : 'other';
    return {
      action: {
        kind: name,
        title: asked === found.balance ? 'Mark invoice paid?' : 'Record payment?',
        lines: [
          `${found.label} · ${found.customer}`,
          `${usd(asked)} by ${method}, ${today}`,
          asked < found.balance ? `Leaves ${usd(found.balance - asked)} owed` : 'Paid in full',
        ],
        url: `/api/crm/invoices/${found.id}/payments`,
        body: { amountCents: asked, method, paymentDate: today, note: 'Recorded with ProBot' },
        openUrl: `/crm/invoices/${found.id}`,
      },
    };
  }

  if (name === 'schedule_visit') {
    const day = resolveDay(text(args.day, 40), today);
    if (!day) return { error: 'Ask which day.' };
    const start = zonedIso(day, text(args.time, 5), context.timeZone);
    if (!start) return { error: 'Ask what time.' };
    const minutes = typeof args.minutes === 'number' && args.minutes >= 15 && args.minutes <= 600 ? Math.round(args.minutes) : 60;
    const end = new Date(new Date(start).getTime() + minutes * 60_000).toISOString();
    const kinds = ['estimate_appointment', 'follow_up', 'business_meeting', 'other'];
    const kind = kinds.includes(String(args.kind)) ? String(args.kind) : 'estimate_appointment';
    let customerId: string | null = null;
    let who = '';
    const customer = text(args.customer, 80);
    if (customer) {
      const rows = await customersNamed(db, context.userId, customer);
      if (rows.length === 0) return { error: `No customer matches "${customer}".` };
      if (rows.length > 1) return { error: `Several customers match (${rows.slice(0, 5).map(contactDisplayName).join(', ')}). Ask which one.` };
      customerId = rows[0].id;
      who = contactDisplayName(rows[0]);
    }
    const when = new Date(start).toLocaleString('en-US', {
      timeZone: context.timeZone,
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
    const label: Record<string, string> = { estimate_appointment: 'Estimate visit', follow_up: 'Follow-up', business_meeting: 'Meeting', other: 'Event' };
    const note = text(args.note, 500);
    return {
      action: {
        kind: name,
        title: 'Add to your calendar?',
        lines: [`${label[kind]}${who ? ` · ${who}` : ''}`, `${when} · ${minutes} min`, ...(note ? [note] : [])],
        url: '/api/crm/tasks',
        body: { task_type: kind, startAt: start, endAt: end, customer_id: customerId, note: note || null, other_label: kind === 'other' ? note.slice(0, 80) || 'Event' : null },
        openUrl: '/crm/calendar',
      },
    };
  }

  // log_hours
  const hours = typeof args.hours === 'number' ? args.hours : Number(args.hours);
  if (!Number.isFinite(hours) || hours <= 0 || hours > 24) return { error: 'Ask how many hours (up to 24).' };
  const day = resolveDay(text(args.day, 40) || 'today', today);
  if (!day) return { error: 'Ask which day.' };
  const project = text(args.project, 80).replace(/[%_,()]/g, ' ').trim();
  const customer = text(args.customer, 80);
  if (!project && !customer) return { error: 'Ask which project.' };
  let query = db
    .from('pro_crm_projects')
    .select('id, name, customer_id, status')
    .eq('owner_id', context.userId)
    .neq('status', 'cancelled')
    .order('updated_at', { ascending: false })
    .limit(10);
  if (project) query = query.ilike('name', `%${project}%`);
  if (customer) {
    const rows = await customersNamed(db, context.userId, customer);
    if (rows.length === 0) return { error: `No customer matches "${customer}".` };
    query = query.in('customer_id', rows.map((row) => row.id));
  }
  const { data } = await query;
  const projects = data ?? [];
  if (projects.length === 0) return { error: 'No project matches. Nothing was prepared.' };
  if (projects.length > 1) return { error: `Several projects match (${projects.slice(0, 5).map((row) => row.name).join(', ')}). Ask which one.` };
  const person = text(args.person, 120);
  const note = text(args.note, 500);
  return {
    action: {
      kind: name,
      title: 'Log hours?',
      lines: [`${hours} h · ${projects[0].name}`, `${day}${person ? ` · ${person}` : ''}`, ...(note ? [note] : [])],
      url: '/api/crm/time-entries',
      body: { projectId: projects[0].id, workDate: day, hours, personName: person || null, note: note || null },
      openUrl: `/crm/projects/${projects[0].id}`,
    },
  };
}
