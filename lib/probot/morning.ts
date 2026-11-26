import type { Json } from '@/lib/types/supabase';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { contactDisplayName } from '@/lib/crm/contact-name';
import { runProTool, todayIn } from '@/lib/agent/pro-tools';
import { proProbotConversation, userLocale } from '@/lib/leads/referrals';
import { chatPushUrl, sendVisitorPushNotification } from '@/lib/services/pushNotificationService';
import type { CrmDb } from '@/lib/crm/crm-scope';
import type { ChatProbotFollowup } from '@/lib/types/chat';
import { BRIEF_WORDS, briefDay, briefLocale, briefMoney, type BriefLocale } from '@/lib/probot/brief-text';
import { DEFAULT_PROBOT_SETTINGS, loadProbotSettingsFor, type ProbotSettings } from '@/lib/probot/settings';

/**
 * ProBot morning brief for a pro: one summary message, then one card per item that needs them.
 * The brief is built from CRM data, not by the AI: no invented numbers, and it works when the
 * AI provider is down. Nothing reaches a customer until the pro taps Send on a card.
 */

export const MORNING_MINUTE = 30;
/** Days between nudges after the pro already acted on a card. */
export const NEXT_NUDGE_DAYS = 7;
export const MAX_CARDS_PER_MORNING = 5;
/** Accepted estimates older than this are not brought up. */
const ACCEPTED_LOOKBACK_DAYS = 30;

type Db = ReturnType<typeof createServiceRoleClient>;
type Kind = ChatProbotFollowup['kind'];

/** Cards that come once (no repeat nudges): projects and accepted estimates. */
const ONE_TIME: Kind[] = ['estimate_accepted', 'project_finishing', 'project_starting'];

/* ---------- pure rules (tested) ---------- */

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
}

export function addDaysIso(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

export interface FollowupCandidate {
  kind: Kind;
  documentId: string;
  documentNumber: string;
  customerId: string;
  amountCents: number;
  /** Invoices and estimates: local date last sent. Others: the day the card is about. */
  sentOn: string;
  /** Invoices: due date. */
  dueDate?: string | null;
  projectName?: string;
  /** Project finish/start date. */
  date?: string;
}

export interface FollowupHistory {
  id: string;
  kind: Kind;
  documentId: string;
  status: 'open' | 'snoozed' | 'sent' | 'done';
  snoozedUntil: string | null;
  /** Local date the pro acted (sent or done). */
  actedOn: string | null;
}

export type FollowupDecision =
  | { action: 'new'; candidate: FollowupCandidate; waitingDays: number; followedUpBefore: boolean }
  | { action: 'wake'; candidate: FollowupCandidate; rowId: string; waitingDays: number; followedUpBefore: boolean };

export interface FollowupRules {
  invoiceDays: number;
  estimateDays: number;
}

/**
 * Which cards go out this morning.
 * - A live card (open, or snoozed until a later day) is left alone; a card snoozed until today wakes.
 * - Invoices and estimates: N days after sending (settings), then 7 days after the pro last acted.
 * - Projects and accepted estimates: once.
 * Order: late invoices, accepted estimates, jobs finishing (final invoice), invoices, jobs starting,
 * estimates waiting; bigger amounts first.
 */
export function pickFollowups(
  candidates: FollowupCandidate[],
  history: FollowupHistory[],
  today: string,
  rules: FollowupRules = { invoiceDays: DEFAULT_PROBOT_SETTINGS.invoiceDays, estimateDays: DEFAULT_PROBOT_SETTINGS.estimateDays },
): FollowupDecision[] {
  const key = (kind: Kind, id: string) => `${kind}:${id}`;
  const byDoc = new Map<string, FollowupHistory[]>();
  for (const row of history) {
    const list = byDoc.get(key(row.kind, row.documentId)) ?? [];
    list.push(row);
    byDoc.set(key(row.kind, row.documentId), list);
  }
  const decisions: FollowupDecision[] = [];
  for (const candidate of candidates) {
    const rows = byDoc.get(key(candidate.kind, candidate.documentId)) ?? [];
    const live = rows.find((row) => row.status === 'open' || row.status === 'snoozed');
    const acted = rows
      .filter((row) => (row.status === 'sent' || row.status === 'done') && row.actedOn)
      .map((row) => row.actedOn!)
      .sort()
      .pop();
    const followedUpBefore = rows.some((row) => row.status === 'sent');
    const lastTouch = acted && acted > candidate.sentOn ? acted : candidate.sentOn;
    if (live) {
      if (live.status === 'snoozed' && live.snoozedUntil && live.snoozedUntil <= today) {
        decisions.push({ action: 'wake', candidate, rowId: live.id, waitingDays: Math.max(0, daysBetween(lastTouch, today)), followedUpBefore });
      }
      continue;
    }
    if (ONE_TIME.includes(candidate.kind)) {
      if (rows.length === 0) decisions.push({ action: 'new', candidate, waitingDays: 0, followedUpBefore: false });
      continue;
    }
    const firstWait = candidate.kind === 'invoice_unpaid' ? rules.invoiceDays : rules.estimateDays;
    const wait = acted && acted >= candidate.sentOn ? NEXT_NUDGE_DAYS : firstWait;
    const waited = daysBetween(lastTouch, today);
    if (waited >= wait) decisions.push({ action: 'new', candidate, waitingDays: waited, followedUpBefore });
  }
  const group = (decision: FollowupDecision) => {
    const c = decision.candidate;
    if (c.kind === 'invoice_unpaid') return c.dueDate && c.dueDate < today ? 0 : 3;
    return { estimate_accepted: 1, project_finishing: 2, project_starting: 4, estimate_waiting: 5 }[c.kind];
  };
  const late = (decision: FollowupDecision) => {
    const c = decision.candidate;
    return c.kind === 'invoice_unpaid' && c.dueDate && c.dueDate < today ? daysBetween(c.dueDate, today) : 0;
  };
  return decisions.sort(
    (a, b) => group(a) - group(b) || late(b) - late(a) || b.candidate.amountCents - a.candidate.amountCents,
  );
}

/** True when it is the pro's brief time (the hourly job runs at :30). */
export function isMorningNow(timeZone: string, hour: number = DEFAULT_PROBOT_SETTINGS.briefHour, now = new Date()): boolean {
  const local = Number(new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hourCycle: 'h23' }).format(now));
  return local === hour;
}

export interface BriefFacts {
  locale?: BriefLocale;
  firstName: string | null;
  today: string;
  appointments: { time: string; what: string; with: string | null }[];
  maintenance: { customer: string; plan: string }[];
  finishing: { name: string; customer: string; finish: string }[];
  starting: { name: string; customer: string; start: string }[];
  openCount: number;
  openCents: number;
  lateCents: number;
  cards: number;
}

function when(date: string, today: string, locale: BriefLocale): string {
  const words = BRIEF_WORDS[locale];
  const days = daysBetween(today, date);
  if (days === 0) return words.today;
  if (days === 1) return words.tomorrow;
  return briefDay(date, locale);
}

/** Null on a quiet day: nothing today, nothing this week, no cards. */
export function buildBriefText(facts: BriefFacts): string | null {
  const locale = facts.locale ?? 'en';
  const words = BRIEF_WORDS[locale];
  const todayCount = facts.appointments.length + facts.maintenance.length;
  if (todayCount === 0 && facts.finishing.length === 0 && facts.starting.length === 0 && facts.cards === 0) return null;
  const lines: string[] = [`${words.hello(facts.firstName)} ${words.hereIs(briefDay(facts.today, locale))}`];
  if (todayCount > 0) {
    lines.push('', words.todayTitle);
    for (const item of facts.appointments) lines.push(`- **${item.time}** ${item.what}${item.with ? `, ${item.with}` : ''}`);
    if (facts.maintenance.length) {
      const names = facts.maintenance.map((item) => item.customer);
      lines.push(`- **${words.maintenance}:** ${facts.maintenance.length} ${words.houses(facts.maintenance.length)} (${names.slice(0, 5).join(', ')}${names.length > 5 ? '…' : ''})`);
    }
  }
  if (facts.finishing.length) {
    lines.push('', words.finishing);
    for (const item of facts.finishing) lines.push(`- **${item.customer}**, ${item.name}, ${words.ends(when(item.finish, facts.today, locale))}`);
  }
  if (facts.starting.length) {
    lines.push('', words.starting);
    for (const item of facts.starting) lines.push(`- **${item.customer}**, ${item.name}, ${words.starts(when(item.start, facts.today, locale))}`);
  }
  if (facts.openCount > 0) {
    lines.push('', words.money(briefMoney(facts.openCents, locale), facts.openCount, facts.lateCents > 0 ? briefMoney(facts.lateCents, locale) : null));
  }
  if (facts.cards > 0) lines.push('', words.needOk(facts.cards));
  return lines.join('\n');
}

export function followupText(card: ChatProbotFollowup, today: string): string {
  const locale = card.locale ?? 'en';
  const words = BRIEF_WORDS[locale];
  const amount = briefMoney(card.amountCents, locale);
  switch (card.kind) {
    case 'invoice_unpaid':
      return words.invoiceUnpaid({ name: card.customerName, number: card.documentNumber, amount, late: card.daysLate ?? 0, before: card.followedUpBefore, days: card.waitingDays });
    case 'estimate_waiting':
      return words.estimateWaiting({ name: card.customerName, number: card.documentNumber, amount, before: card.followedUpBefore, days: card.waitingDays });
    case 'estimate_accepted':
      return words.estimateAccepted({ name: card.customerName, number: card.documentNumber, amount });
    case 'project_finishing':
      return words.projectFinishing({ name: card.customerName, project: card.projectName ?? '', when: when(card.date ?? today, today, locale) });
    case 'project_starting':
      return words.projectStarting({ name: card.customerName, project: card.projectName ?? '', when: when(card.date ?? today, today, locale) });
  }
}

/* ---------- data ---------- */

async function loadCandidates(db: Db, ownerId: string, timeZone: string, today: string, settings: ProbotSettings): Promise<FollowupCandidate[]> {
  const crm = db as unknown as CrmDb;
  const local = (iso: string) => todayIn(timeZone, new Date(iso));
  const weekEnd = addDaysIso(today, 7);
  const [invoices, estimates, accepted, finishing, starting] = await Promise.all([
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
    settings.projectCards
      ? db
          .from('pro_crm_estimates')
          .select('id, display_id, customer_id, amount_cents, agreement_kind, signed_at, updated_at')
          .eq('owner_id', ownerId)
          .eq('status', 'accepted')
          .neq('agreement_kind', 'maintenance')
          .gte('updated_at', `${addDaysIso(today, -ACCEPTED_LOOKBACK_DAYS)}T00:00:00Z`)
          .limit(50)
      : Promise.resolve({ data: [] as { id: string; display_id: string; customer_id: string; amount_cents: number; agreement_kind: string; signed_at: string | null; updated_at: string }[] }),
    settings.projectCards
      ? db
          .from('pro_crm_projects')
          .select('id, display_id, customer_id, name, end_date')
          .eq('owner_id', ownerId)
          .in('status', ['planned', 'in_progress'])
          .gte('end_date', today)
          .lte('end_date', weekEnd)
          .limit(30)
      : Promise.resolve({ data: [] as { id: string; display_id: string; customer_id: string; name: string; end_date: string | null }[] }),
    settings.projectCards
      ? db
          .from('pro_crm_projects')
          .select('id, display_id, customer_id, name, start_date')
          .eq('owner_id', ownerId)
          .eq('status', 'planned')
          .gte('start_date', today)
          .lte('start_date', addDaysIso(today, settings.projectStartDays))
          .limit(30)
      : Promise.resolve({ data: [] as { id: string; display_id: string; customer_id: string; name: string; start_date: string | null }[] }),
  ]);
  const invoiceRows = (invoices.data ?? []).filter((row) => row.amount_cents - (row.payment_applied_cents ?? 0) > 0);
  const estimateRows = estimates.data ?? [];

  // Accepted estimates that already became a project are skipped.
  const acceptedRows = accepted.data ?? [];
  const withProject = new Set<string>();
  if (acceptedRows.length) {
    const { data } = await db.from('pro_crm_projects').select('estimate_id').eq('owner_id', ownerId).in('estimate_id', acceptedRows.map((row) => row.id));
    for (const row of data ?? []) if (row.estimate_id) withProject.add(row.estimate_id);
  }

  const [sentEvents, estimateSends] = await Promise.all([
    invoiceRows.length
      ? db.from('pro_crm_document_events').select('invoice_id, created_at').eq('owner_id', ownerId).eq('action', 'sent').in('invoice_id', invoiceRows.map((row) => row.id))
      : Promise.resolve({ data: [] as { invoice_id: string; created_at: string }[] }),
    estimateRows.length
      ? crm.from('pro_crm_activity').select('estimate_id, occurred_at').eq('owner_id', ownerId).eq('kind', 'estimate_sent').in('estimate_id', estimateRows.map((row) => row.id))
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
    ...acceptedRows
      .filter((row) => !withProject.has(row.id))
      .map((row) => ({
        kind: 'estimate_accepted' as const,
        documentId: row.id,
        documentNumber: `#${row.display_id}`,
        customerId: row.customer_id,
        amountCents: row.amount_cents,
        sentOn: local(row.signed_at ?? row.updated_at),
      })),
    ...(finishing.data ?? []).map((row) => ({
      kind: 'project_finishing' as const,
      documentId: row.id,
      documentNumber: `#${row.display_id}`,
      customerId: row.customer_id,
      amountCents: 0,
      sentOn: today,
      projectName: row.name,
      date: row.end_date ?? today,
    })),
    ...(starting.data ?? []).map((row) => ({
      kind: 'project_starting' as const,
      documentId: row.id,
      documentNumber: `#${row.display_id}`,
      customerId: row.customer_id,
      amountCents: 0,
      sentOn: today,
      projectName: row.name,
      date: row.start_date ?? today,
    })),
  ];
}

interface HistoryRow {
  id: string;
  kind: Kind;
  invoice_id: string | null;
  estimate_id: string | null;
  project_id?: string | null;
  status: FollowupHistory['status'];
  snoozed_until: string | null;
  acted_at: string | null;
}

async function loadHistory(db: CrmDb, ownerId: string, timeZone: string): Promise<FollowupHistory[]> {
  let result: { data: unknown[] | null; error: { message: string } | null } = await db
    .from('probot_followups')
    .select('id, kind, invoice_id, estimate_id, project_id, status, snoozed_until, acted_at')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
    .limit(1000);
  // Before 172_probot_brief_week2 there is no project_id.
  if (result.error && /project_id/.test(result.error.message)) {
    result = await db
      .from('probot_followups')
      .select('id, kind, invoice_id, estimate_id, status, snoozed_until, acted_at')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })
      .limit(1000);
  }
  if (result.error) throw new Error(result.error.message);
  return ((result.data ?? []) as HistoryRow[]).map((row) => ({
    id: row.id,
    kind: row.kind,
    documentId: (row.invoice_id ?? row.estimate_id ?? row.project_id)!,
    status: row.status,
    snoozedUntil: row.snoozed_until,
    actedOn: row.acted_at ? todayIn(timeZone, new Date(row.acted_at)) : null,
  }));
}

function documentColumn(kind: Kind): 'invoice_id' | 'estimate_id' | 'project_id' {
  if (kind === 'invoice_unpaid') return 'invoice_id';
  if (kind === 'estimate_waiting' || kind === 'estimate_accepted') return 'estimate_id';
  return 'project_id';
}

/**
 * The briefs live in one "Morning briefs" ProBot chat on the pro's business profile (their default
 * business), so they show when the pro is acting as the business. Null before migration 180.
 */
async function briefChat(db: Db, ownerId: string, conversationId: string): Promise<string | null> {
  const { data: settings } = await db.from('pro_invoice_settings').select('default_business_id').eq('owner_id', ownerId).maybeSingle();
  let businessId = settings?.default_business_id ?? null;
  if (!businessId) {
    const { data: business } = await db.from('businesses').select('id').eq('owner_id', ownerId).eq('is_active', true).order('created_at').limit(1).maybeSingle();
    businessId = business?.id ?? null;
  }
  if (!businessId) return null;
  const title = 'Morning briefs';
  const { data: existing, error } = await db
    .from('probot_chats')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('profile_key', businessId)
    .eq('title', title)
    .limit(1)
    .maybeSingle();
  if (error) return null;
  if (existing) {
    // Newest on top of the chat list.
    await db.from('probot_chats').update({ updated_at: new Date().toISOString() }).eq('id', existing.id);
    return existing.id;
  }
  const { data: created } = await db
    .from('probot_chats')
    .insert({ conversation_id: conversationId, profile_key: businessId, title })
    .select('id')
    .single();
  return created?.id ?? null;
}

async function postMessage(
  db: Db,
  conversationId: string,
  body: string,
  payload: Record<string, unknown> | null,
  chatId: string | null = null
): Promise<string | null> {
  const row = { conversation_id: conversationId, sender: 'admin' as const, admin_sent_as: 'probot', body, payload: payload as unknown as Json };
  let { data, error } = await db
    .from('probot_messages')
    .insert(chatId ? { ...row, chat_id: chatId } : row)
    .select('id')
    .single();
  if (error && chatId) {
    ({ data, error } = await db.from('probot_messages').insert(row).select('id').single());
  }
  if (!data) return null;
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
 * (a manual run). Cards already open are never repeated, so a second run does not double them.
 */
export async function runMorningForPro(
  ownerId: string,
  options: { settings?: ProbotSettings; force?: boolean; now?: Date } = {},
): Promise<MorningResult> {
  const db = createServiceRoleClient();
  const crm = db as unknown as CrmDb;
  const settings = options.settings ?? (await loadProbotSettingsFor(ownerId));
  const timeZone = settings.timeZone;
  const now = options.now ?? new Date();
  if (!options.force) {
    if (!settings.briefEnabled) return { ownerId, sent: false, cards: 0, reason: 'off' };
    if (!isMorningNow(timeZone, settings.briefHour, now)) return { ownerId, sent: false, cards: 0, reason: 'not morning' };
  }
  const today = todayIn(timeZone, now);

  // Claim today first, so two runs never post twice.
  if (!options.force) {
    const claim = await crm.from('probot_morning_runs').insert({ owner_id: ownerId, run_date: today });
    if (claim.error) return { ownerId, sent: false, cards: 0, reason: claim.error.code === '23505' ? 'already sent' : claim.error.message };
  }

  const [candidates, history, schedule, open, profile, locale] = await Promise.all([
    loadCandidates(db, ownerId, timeZone, today, settings),
    loadHistory(crm, ownerId, timeZone),
    runProTool('get_day_schedule', { day: 'today' }, { userId: ownerId, timeZone }),
    runProTool('get_open_invoices', {}, { userId: ownerId, timeZone }),
    db.from('profiles').select('first_name').eq('id', ownerId).maybeSingle(),
    userLocale(db, ownerId).then(briefLocale),
  ]);
  const decisions = pickFollowups(candidates, history, today, settings).slice(0, MAX_CARDS_PER_MORNING);

  // Projects starting or finishing in the next 7 days, for the brief.
  const weekEnd = addDaysIso(today, 7);
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
    appointments?: BriefFacts['appointments'];
    maintenance?: BriefFacts['maintenance'];
    visitRequests?: { time: string; with: string | null; service: string | null }[];
  };
  const openData = (open.data ?? {}) as { count?: number; invoices?: { balance: string | null; daysLate: number }[]; totalOwed?: string | null };
  const cents = (value: string | null | undefined) => Math.round(Number.parseFloat(value ?? '0') * 100) || 0;
  const words = BRIEF_WORDS[locale];
  const appointments = [
    ...(day.appointments ?? []),
    ...(day.visitRequests ?? []).map((visit) => ({ time: visit.time, what: visit.service ? `${words.visitRequest} (${visit.service})` : words.visitRequest, with: visit.with })),
  ];

  const brief = buildBriefText({
    locale,
    firstName: profile.data?.first_name ?? null,
    today,
    appointments,
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
  const chatId = await briefChat(db, ownerId, conversationId).catch(() => null);
  await postMessage(db, conversationId, brief, { morningBrief: { date: today, locale } }, chatId);

  let cards = 0;
  for (const decision of decisions) {
    const c = decision.candidate;
    let rowId = decision.action === 'wake' ? decision.rowId : null;
    if (!rowId) {
      const inserted = await crm
        .from('probot_followups')
        .insert({ owner_id: ownerId, kind: c.kind, [documentColumn(c.kind)]: c.documentId })
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
      customerId: c.customerId,
      customerName: nameOf(c.customerId),
      customerPhone: customer?.mobile_number || customer?.phone || null,
      amountCents: c.amountCents,
      waitingDays: decision.waitingDays,
      ...(c.kind === 'invoice_unpaid' && c.dueDate && c.dueDate < today ? { daysLate: daysBetween(c.dueDate, today) } : {}),
      ...(c.projectName ? { projectName: c.projectName } : {}),
      ...(c.date ? { date: c.date } : {}),
      followedUpBefore: decision.followedUpBefore,
      status: 'open',
      locale,
    };
    const messageId = await postMessage(db, conversationId, followupText(card, today), { followup: card }, chatId);
    await crm.from('probot_followups').update({ status: 'open', snoozed_until: null, message_id: messageId }).eq('id', rowId);
    cards += 1;
  }

  await db.from('probot_conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);
  if (settings.pushEnabled) {
    const pushBody = cards > 0 ? words.pushCards(cards) : words.pushReady;
    await sendVisitorPushNotification(conversationId, words.pushTitle, pushBody, chatPushUrl(locale)).catch(() => undefined);
  }
  return { ownerId, sent: true, cards };
}

/** Every CRM owner: pros with a business (crew members are not included). */
export async function listCrmOwners(): Promise<string[]> {
  const db = createServiceRoleClient();
  const { data } = await db.from('businesses').select('owner_id').eq('is_active', true).not('owner_id', 'is', null).limit(5000);
  return [...new Set((data ?? []).map((row) => row.owner_id).filter((id): id is string => Boolean(id)))];
}
