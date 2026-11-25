import type { Json } from '@/lib/types/supabase';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { contactDisplayName } from '@/lib/crm/contact-name';
import { DEFAULT_PRO_TIME_ZONE, runProTool, todayIn } from '@/lib/agent/pro-tools';
import { proProbotConversation } from '@/lib/leads/referrals';
import { chatPushUrl, sendVisitorPushNotification } from '@/lib/services/pushNotificationService';
import type { CrmDb } from '@/lib/crm/crm-scope';
import type { ChatProbotFollowup } from '@/lib/types/chat';

/**
 * ProBot morning brief for a pro: one summary message, then one card per item that needs them.
 * The brief is built from CRM data, not by the AI: no invented numbers, and it works when the
 * AI provider is down. Nothing reaches a customer until the pro taps Send on a card.
 */

export const MORNING_HOUR = 6;
export const MORNING_MINUTE = 30;
/** Days after sending before the first nudge, and between nudges after that. */
export const FIRST_NUDGE_DAYS = 3;
export const NEXT_NUDGE_DAYS = 7;
export const MAX_CARDS_PER_MORNING = 5;

type Db = ReturnType<typeof createServiceRoleClient>;

/* ---------- pure rules (tested) ---------- */

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
}

export interface FollowupCandidate {
  kind: ChatProbotFollowup['kind'];
  documentId: string;
  documentNumber: string;
  customerId: string;
  amountCents: number;
  /** Local date it was last sent to the customer. */
  sentOn: string;
  /** Invoices: due date. */
  dueDate?: string | null;
}

export interface FollowupHistory {
  id: string;
  documentId: string;
  status: 'open' | 'snoozed' | 'sent' | 'done';
  snoozedUntil: string | null;
  /** Local date the pro acted (sent or done). */
  actedOn: string | null;
}

export type FollowupDecision =
  | { action: 'new'; candidate: FollowupCandidate; waitingDays: number; followedUpBefore: boolean }
  | { action: 'wake'; candidate: FollowupCandidate; rowId: string; waitingDays: number; followedUpBefore: boolean };

/**
 * Which documents get a card this morning.
 * - A live card (open, or snoozed until a later day) is left alone.
 * - A card snoozed until today or earlier wakes up.
 * - Otherwise: 3 days after it was sent, or 7 days after the pro last acted on a card.
 * Most urgent first: late invoices, then other invoices, then estimates; bigger amounts first.
 */
export function pickFollowups(candidates: FollowupCandidate[], history: FollowupHistory[], today: string): FollowupDecision[] {
  const byDoc = new Map<string, FollowupHistory[]>();
  for (const row of history) {
    const list = byDoc.get(row.documentId) ?? [];
    list.push(row);
    byDoc.set(row.documentId, list);
  }
  const decisions: FollowupDecision[] = [];
  for (const candidate of candidates) {
    const rows = byDoc.get(candidate.documentId) ?? [];
    const live = rows.find((row) => row.status === 'open' || row.status === 'snoozed');
    const acted = rows
      .filter((row) => (row.status === 'sent' || row.status === 'done') && row.actedOn)
      .map((row) => row.actedOn!)
      .sort()
      .pop();
    const followedUpBefore = rows.some((row) => row.status === 'sent');
    if (live) {
      if (live.status === 'snoozed' && live.snoozedUntil && live.snoozedUntil <= today) {
        decisions.push({ action: 'wake', candidate, rowId: live.id, waitingDays: daysBetween(acted && acted > candidate.sentOn ? acted : candidate.sentOn, today), followedUpBefore });
      }
      continue;
    }
    const lastTouch = acted && acted > candidate.sentOn ? acted : candidate.sentOn;
    const wait = acted && acted >= candidate.sentOn ? NEXT_NUDGE_DAYS : FIRST_NUDGE_DAYS;
    const waited = daysBetween(lastTouch, today);
    if (waited >= wait) decisions.push({ action: 'new', candidate, waitingDays: waited, followedUpBefore });
  }
  const rank = (decision: FollowupDecision) => {
    const c = decision.candidate;
    const late = c.kind === 'invoice_unpaid' && c.dueDate && c.dueDate < today ? daysBetween(c.dueDate, today) : 0;
    return [c.kind === 'invoice_unpaid' ? (late > 0 ? 0 : 1) : 2, -late, -c.amountCents] as const;
  };
  return decisions.sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    return ra[0] - rb[0] || ra[1] - rb[1] || ra[2] - rb[2];
  });
}

/** True when it is the pro's brief time (the hourly job runs at :30). */
export function isMorningNow(timeZone: string, now = new Date()): boolean {
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hourCycle: 'h23' }).format(now));
  return hour === MORNING_HOUR;
}

const money = (cents: number) => `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export interface BriefFacts {
  firstName: string | null;
  today: string;
  dayName: string;
  appointments: { time: string; what: string; with: string | null }[];
  maintenance: { customer: string; plan: string }[];
  finishing: { name: string; customer: string; finish: string }[];
  starting: { name: string; customer: string; start: string }[];
  openCount: number;
  openCents: number;
  lateCents: number;
  cards: number;
}

function when(date: string, today: string): string {
  const days = daysBetween(today, date);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** Null on a quiet day: nothing today, nothing this week, no cards. */
export function buildBriefText(facts: BriefFacts): string | null {
  const today = facts.appointments.length + facts.maintenance.length;
  if (today === 0 && facts.finishing.length === 0 && facts.starting.length === 0 && facts.cards === 0) return null;
  const lines: string[] = [`☀️ **Good morning${facts.firstName ? `, ${facts.firstName}` : ''}!** Here is ${facts.dayName}.`];
  if (today > 0) {
    lines.push('', '**📅 Today**');
    for (const item of facts.appointments) lines.push(`- **${item.time}** ${item.what}${item.with ? `, ${item.with}` : ''}`);
    if (facts.maintenance.length) {
      const names = facts.maintenance.map((item) => item.customer);
      lines.push(`- **Maintenance:** ${facts.maintenance.length} ${facts.maintenance.length === 1 ? 'house' : 'houses'} (${names.slice(0, 5).join(', ')}${names.length > 5 ? '…' : ''})`);
    }
  }
  if (facts.finishing.length) {
    lines.push('', '**🏁 Finishing this week**');
    for (const item of facts.finishing) lines.push(`- **${item.customer}**, ${item.name}, ends ${when(item.finish, facts.today)}`);
  }
  if (facts.starting.length) {
    lines.push('', '**🚧 Starting this week**');
    for (const item of facts.starting) lines.push(`- **${item.customer}**, ${item.name}, starts ${when(item.start, facts.today)}`);
  }
  if (facts.openCount > 0) {
    lines.push('', `**💰 Money:** ${money(facts.openCents)} open on ${facts.openCount} ${facts.openCount === 1 ? 'invoice' : 'invoices'}${facts.lateCents > 0 ? `, ${money(facts.lateCents)} of it late` : ''}.`);
  }
  if (facts.cards > 0) {
    lines.push('', `**📋 ${facts.cards} ${facts.cards === 1 ? 'thing needs' : 'things need'} your OK** below. Nothing goes to a customer until you tap Send.`);
  }
  return lines.join('\n');
}

export function followupText(card: ChatProbotFollowup): string {
  const amount = money(card.amountCents);
  if (card.kind === 'invoice_unpaid') {
    const late = card.daysLate && card.daysLate > 0 ? `, ${card.daysLate} ${card.daysLate === 1 ? 'day' : 'days'} late` : '';
    return `${card.customerName} has not paid invoice ${card.documentNumber} (${amount}${late}). ${card.followedUpBefore ? 'Last reminder' : 'Sent'} ${card.waitingDays} days ago.`;
  }
  return `${card.customerName} has not answered estimate ${card.documentNumber} (${amount}). ${card.followedUpBefore ? 'Last follow-up' : 'Sent'} ${card.waitingDays} days ago.`;
}

/* ---------- data ---------- */

async function loadCandidates(db: Db, ownerId: string, timeZone: string): Promise<FollowupCandidate[]> {
  const local = (iso: string) => todayIn(timeZone, new Date(iso));
  const [invoices, estimates] = await Promise.all([
    db
      .from('pro_crm_invoices')
      .select('id, invoice_number, display_id, customer_id, amount_cents, payment_applied_cents, invoice_date, due_date, created_at')
      .eq('owner_id', ownerId)
      .in('status', ['sent', 'partial', 'overdue'])
      .limit(200),
    db
      .from('pro_crm_estimates')
      .select('id, display_id, customer_id, amount_cents, updated_at')
      .eq('owner_id', ownerId)
      .eq('status', 'sent')
      .limit(200),
  ]);
  const invoiceRows = (invoices.data ?? []).filter((row) => row.amount_cents - (row.payment_applied_cents ?? 0) > 0);
  const estimateRows = estimates.data ?? [];

  const [sentEvents, estimateSends] = await Promise.all([
    invoiceRows.length
      ? db.from('pro_crm_document_events').select('invoice_id, created_at').eq('owner_id', ownerId).eq('action', 'sent').in('invoice_id', invoiceRows.map((row) => row.id))
      : Promise.resolve({ data: [] as { invoice_id: string; created_at: string }[] }),
    estimateRows.length
      ? (db as unknown as CrmDb).from('pro_crm_activity').select('estimate_id, occurred_at').eq('owner_id', ownerId).eq('kind', 'estimate_sent').in('estimate_id', estimateRows.map((row) => row.id))
      : Promise.resolve({ data: [] as { estimate_id: string; occurred_at: string }[] }),
  ]);
  const lastSent = new Map<string, string>();
  for (const row of (sentEvents.data ?? []) as { invoice_id: string; created_at: string }[]) {
    const day = local(row.created_at);
    if ((lastSent.get(row.invoice_id) ?? '') < day) lastSent.set(row.invoice_id, day);
  }
  for (const row of (estimateSends.data ?? []) as { estimate_id: string; occurred_at: string }[]) {
    const day = local(row.occurred_at);
    if ((lastSent.get(row.estimate_id) ?? '') < day) lastSent.set(row.estimate_id, day);
  }

  return [
    ...invoiceRows.map((row) => ({
      kind: 'invoice_unpaid' as const,
      documentId: row.id,
      documentNumber: `#${row.invoice_number || row.display_id}`,
      customerId: row.customer_id,
      amountCents: row.amount_cents - (row.payment_applied_cents ?? 0),
      sentOn: lastSent.get(row.id) ?? row.invoice_date ?? local(row.created_at),
      dueDate: row.due_date,
    })),
    ...estimateRows.map((row) => ({
      kind: 'estimate_waiting' as const,
      documentId: row.id,
      documentNumber: `#${row.display_id}`,
      customerId: row.customer_id,
      amountCents: row.amount_cents,
      sentOn: lastSent.get(row.id) ?? local(row.updated_at),
    })),
  ];
}

async function loadHistory(db: CrmDb, ownerId: string, timeZone: string): Promise<FollowupHistory[]> {
  const { data, error } = await db
    .from('probot_followups')
    .select('id, invoice_id, estimate_id, status, snoozed_until, acted_at')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return ((data ?? []) as { id: string; invoice_id: string | null; estimate_id: string | null; status: FollowupHistory['status']; snoozed_until: string | null; acted_at: string | null }[]).map((row) => ({
    id: row.id,
    documentId: (row.invoice_id ?? row.estimate_id)!,
    status: row.status,
    snoozedUntil: row.snoozed_until,
    actedOn: row.acted_at ? todayIn(timeZone, new Date(row.acted_at)) : null,
  }));
}

async function postMessage(db: Db, conversationId: string, body: string, payload: Record<string, unknown> | null): Promise<string | null> {
  const { data, error } = await db
    .from('probot_messages')
    .insert({ conversation_id: conversationId, sender: 'admin', admin_sent_as: 'probot', body, payload: payload as unknown as Json })
    .select('id')
    .single();
  if (error) {
    console.error('[probot-morning] message', error.message);
    return null;
  }
  return data.id;
}

export interface MorningResult {
  ownerId: string;
  sent: boolean;
  cards: number;
  reason?: string;
}

/**
 * Build and post one pro's morning brief and cards. `force` skips the time and once-a-day checks
 * (for a manual run). Safe to call twice: probot_morning_runs keeps one brief per local day.
 */
export async function runMorningForPro(ownerId: string, options: { timeZone?: string; force?: boolean; now?: Date } = {}): Promise<MorningResult> {
  const db = createServiceRoleClient();
  const crm = db as unknown as CrmDb;
  const timeZone = options.timeZone ?? DEFAULT_PRO_TIME_ZONE;
  const now = options.now ?? new Date();
  if (!options.force && !isMorningNow(timeZone, now)) return { ownerId, sent: false, cards: 0, reason: 'not morning' };
  const today = todayIn(timeZone, now);

  // Claim today first, so two runs never post twice.
  if (!options.force) {
    const claim = await crm.from('probot_morning_runs').insert({ owner_id: ownerId, run_date: today });
    if (claim.error) return { ownerId, sent: false, cards: 0, reason: claim.error.code === '23505' ? 'already sent' : claim.error.message };
  }

  const [candidates, history, schedule, open, profile] = await Promise.all([
    loadCandidates(db, ownerId, timeZone),
    loadHistory(crm, ownerId, timeZone),
    runProTool('get_day_schedule', { day: 'today' }, { userId: ownerId, timeZone }),
    runProTool('get_open_invoices', {}, { userId: ownerId, timeZone }),
    db.from('profiles').select('first_name').eq('id', ownerId).maybeSingle(),
  ]);
  const decisions = pickFollowups(candidates, history, today).slice(0, MAX_CARDS_PER_MORNING);

  // Projects starting or finishing in the next 7 days.
  const weekEnd = new Date(Date.parse(`${today}T12:00:00Z`) + 7 * 86_400_000).toISOString().slice(0, 10);
  const [finishingRows, startingRows] = await Promise.all([
    db.from('pro_crm_projects').select('name, customer_id, end_date').eq('owner_id', ownerId).in('status', ['planned', 'in_progress']).gte('end_date', today).lte('end_date', weekEnd).order('end_date').limit(10),
    db.from('pro_crm_projects').select('name, customer_id, start_date').eq('owner_id', ownerId).eq('status', 'planned').gte('start_date', today).lte('start_date', weekEnd).order('start_date').limit(10),
  ]);
  const customerIds = [
    ...decisions.map((decision) => decision.candidate.customerId),
    ...(finishingRows.data ?? []).map((row) => row.customer_id),
    ...(startingRows.data ?? []).map((row) => row.customer_id),
  ];
  const { data: customers } = customerIds.length
    ? await db.from('pro_crm_customers').select('id, first_name, last_name, display_name, company_name, phone, mobile_number').eq('owner_id', ownerId).in('id', [...new Set(customerIds)])
    : { data: [] };
  const customerById = new Map((customers ?? []).map((row) => [row.id, row]));
  const nameOf = (id: string) => {
    const row = customerById.get(id);
    return row ? contactDisplayName(row) : 'Customer';
  };

  const day = (schedule.data ?? {}) as {
    dayName?: string;
    appointments?: BriefFacts['appointments'];
    maintenance?: BriefFacts['maintenance'];
  };
  const openData = (open.data ?? {}) as { count?: number; invoices?: { balance: string | null; daysLate: number }[]; totalOwed?: string | null };
  const cents = (value: string | null | undefined) => Math.round(Number.parseFloat(value ?? '0') * 100) || 0;

  const brief = buildBriefText({
    firstName: profile.data?.first_name ?? null,
    today,
    dayName: day.dayName ?? today,
    appointments: day.appointments ?? [],
    maintenance: day.maintenance ?? [],
    finishing: (finishingRows.data ?? []).map((row) => ({ name: row.name, customer: nameOf(row.customer_id), finish: row.end_date! })),
    starting: (startingRows.data ?? []).map((row) => ({ name: row.name, customer: nameOf(row.customer_id), start: row.start_date! })),
    openCount: openData.count ?? 0,
    openCents: cents(openData.totalOwed),
    lateCents: (openData.invoices ?? []).filter((row) => row.daysLate > 0).reduce((sum, row) => sum + cents(row.balance), 0),
    cards: decisions.length,
  });
  if (!brief) return { ownerId, sent: false, cards: 0, reason: 'quiet day' };

  const conversationId = await proProbotConversation(db, ownerId);
  await postMessage(db, conversationId, brief, null);

  let cards = 0;
  for (const decision of decisions) {
    const c = decision.candidate;
    let rowId = decision.action === 'wake' ? decision.rowId : null;
    if (!rowId) {
      const inserted = await crm
        .from('probot_followups')
        .insert({ owner_id: ownerId, kind: c.kind, ...(c.kind === 'invoice_unpaid' ? { invoice_id: c.documentId } : { estimate_id: c.documentId }) })
        .select('id')
        .single();
      if (inserted.error || !inserted.data) continue;
      rowId = (inserted.data as { id: string }).id;
    }
    const customer = customerById.get(c.customerId);
    const card: ChatProbotFollowup = {
      followupId: rowId,
      kind: c.kind,
      documentId: c.documentId,
      documentNumber: c.documentNumber,
      customerName: nameOf(c.customerId),
      customerPhone: customer?.mobile_number || customer?.phone || null,
      amountCents: c.amountCents,
      waitingDays: decision.waitingDays,
      ...(c.kind === 'invoice_unpaid' && c.dueDate && c.dueDate < today ? { daysLate: daysBetween(c.dueDate, today) } : {}),
      followedUpBefore: decision.followedUpBefore,
      status: 'open',
    };
    const messageId = await postMessage(db, conversationId, followupText(card), { followup: card });
    await crm.from('probot_followups').update({ status: 'open', snoozed_until: null, message_id: messageId }).eq('id', rowId);
    cards += 1;
  }

  await db.from('probot_conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);
  const pushBody = cards > 0
    ? `${cards} ${cards === 1 ? 'thing needs' : 'things need'} your OK today.`
    : 'Your day is ready.';
  await sendVisitorPushNotification(conversationId, '☀️ Good morning from ProBot', pushBody, chatPushUrl('en')).catch(() => undefined);
  return { ownerId, sent: true, cards };
}

/** Every CRM owner: pros with a business (crew members are not included). */
export async function listCrmOwners(): Promise<string[]> {
  const db = createServiceRoleClient();
  const { data } = await db.from('businesses').select('owner_id').eq('is_active', true).not('owner_id', 'is', null).limit(5000);
  return [...new Set((data ?? []).map((row) => row.owner_id).filter((id): id is string => Boolean(id)))];
}
