/**
 * One step on a property timeline. The homeowner's My Places timeline and the pro's Customer
 * portal timeline both draw these, so the two see the same steps in the same way: estimate,
 * approval, invoices, payments, project, maintenance visits and files.
 */

export type TimelineStepKind =
  | 'estimate'
  | 'approved'
  | 'declined'
  | 'invoice'
  | 'reminder'
  | 'viewed'
  | 'payment'
  | 'paid'
  | 'project'
  | 'project_done'
  | 'maintenance'
  | 'visit'
  | 'document'
  | 'pro'
  | 'appointment'
  | 'place';

export interface TimelineStep {
  id: string;
  kind: TimelineStepKind;
  /** ISO date or timestamp. */
  at: string;
  title: string;
  detail?: string | null;
  amountCents?: number | null;
  href?: string | null;
  /**
   * Pro side only: whether the homeowner sees this step too. Drafts and private files are the
   * pro's own; undefined on the homeowner side.
   */
  customerSees?: boolean;
  /** Who did it: the badges show each side what the other side did. */
  by?: 'pro' | 'customer';
  /** The tab it belongs to besides the timeline; null for timeline-only steps. */
  tab?: StepTab | null;
}

export type StepTab = 'projects' | 'maintenance' | 'appointments' | 'documents' | 'invoices' | 'estimates';

const KIND_TAB: Partial<Record<TimelineStepKind, StepTab>> = {
  estimate: 'estimates',
  approved: 'estimates',
  declined: 'estimates',
  invoice: 'invoices',
  reminder: 'invoices',
  payment: 'invoices',
  paid: 'invoices',
  project: 'projects',
  project_done: 'projects',
  maintenance: 'maintenance',
  visit: 'maintenance',
  document: 'documents',
  appointment: 'appointments',
};

/** Tab for a step: its own, else by kind. */
export function stepTab(step: TimelineStep): StepTab | null {
  return step.tab !== undefined ? step.tab : KIND_TAB[step.kind] ?? null;
}

/** Homeowner place events done by the homeowner themselves (the rest come from a pro). */
const CUSTOMER_PLACE_EVENTS = new Set([
  'place_entered',
  'place_updated',
  'estimate_approved',
  'estimate_declined',
  'invoice_paid',
  'maintenance_stopped',
  'appointment_booked',
  'appointment_cancelled',
  'appointment_rescheduled',
]);
export function placeEventBy(kind: string): 'pro' | 'customer' {
  return CUSTOMER_PLACE_EVENTS.has(kind) ? 'customer' : 'pro';
}

/**
 * Unread counts for one viewer: steps the other side did after the viewer last opened each tab.
 * `seen` maps tab ('timeline', 'invoices', …) to an ISO time; missing means never opened.
 */
export function unreadCounts(
  steps: TimelineStep[],
  viewer: 'pro' | 'customer',
  seen: Record<string, string | undefined>
): Record<string, number> {
  const counts: Record<string, number> = { timeline: 0 };
  const time = (iso: string) => Date.parse(iso.length === 10 ? `${iso}T12:00:00` : iso) || 0;
  for (const step of steps) {
    if ((step.by ?? 'pro') === viewer) continue;
    if (viewer === 'customer' && step.customerSees === false) continue;
    const at = time(step.at);
    if (!seen.timeline || at > time(seen.timeline)) counts.timeline += 1;
    const tab = stepTab(step);
    if (tab && (!seen[tab] || at > time(seen[tab]!))) counts[tab] = (counts[tab] ?? 0) + 1;
  }
  return counts;
}

/** Newest first; same day keeps the given order. */
export function sortSteps(steps: TimelineStep[]): TimelineStep[] {
  return steps
    .map((step, index) => ({ step, index, time: Date.parse(step.at.length === 10 ? `${step.at}T12:00:00` : step.at) || 0 }))
    .sort((a, b) => b.time - a.time || a.index - b.index)
    .map((row) => row.step);
}

/** The homeowner's saved place events (customer_place_events) as steps. */
const PLACE_EVENT_STEP: Record<string, TimelineStepKind> = {
  place_entered: 'place',
  place_updated: 'place',
  pro_linked: 'pro',
  estimate_received: 'estimate',
  estimate_approved: 'approved',
  estimate_declined: 'declined',
  invoice_received: 'invoice',
  invoice_paid: 'paid',
  document_received: 'document',
  project_shared: 'project',
  maintenance_started: 'maintenance',
  maintenance_stopped: 'maintenance',
  appointment_booked: 'appointment',
  appointment_cancelled: 'appointment',
  appointment_completed: 'visit',
  appointment_rescheduled: 'appointment',
  invoice_reminder: 'reminder',
  payment_received: 'payment',
  project_completed: 'project_done',
  visit_completed: 'visit',
};

export function placeEventStepKind(kind: string): TimelineStepKind {
  return PLACE_EVENT_STEP[kind] ?? 'place';
}

interface ProHistory {
  estimates: Array<{
    id: string;
    display_id: string;
    amount_cents: number;
    status: string;
    job_area: string | null;
    created_at: string;
    updated_at?: string | null;
    signed_at?: string | null;
    signer_name?: string | null;
  }>;
  invoices: Array<{
    id: string;
    display_id: string;
    invoice_number: string;
    amount_cents: number;
    status: string;
    invoice_date: string;
    created_at?: string | null;
  }>;
  payments: Array<{ id: string; invoice_id: string; amount_cents: number; payment_date: string; method: string }>;
  /** Invoice activity log. Gives real send times, re-sends, reminders, voids and cancels. */
  invoiceEvents?: Array<{ id: string; invoice_id: string; action: string; payload: unknown; created_at: string }>;
  /** Estimate sends, customers opening links, statements (migration 166). */
  activity?: Array<{ id: string; kind: string; estimate_id: string | null; invoice_id: string | null; detail: string | null; occurred_at: string }>;
  /** Appointments the customer booked with the pro at this property. */
  bookings?: Array<{ id: string; service_name: string | null; status: string; slot_start_at: string; created_at: string; updated_at?: string | null }>;
  plans: Array<{ id: string; name: string; frequency: string; is_active: boolean; created_at?: string | null }>;
  visits: Array<{
    id: string;
    maintenance_plan_id: string | null;
    status: string;
    started_at: string;
    ended_at?: string | null;
    labor_seconds: number | null;
    duration_seconds: number | null;
  }>;
  projects: Array<{
    id: string;
    name: string;
    status: string;
    start_date: string | null;
    end_date: string | null;
    shared?: boolean | null;
  }>;
  documents: Array<{ id: string; title: string; kind: string; created_at: string; visible_to_customer?: boolean | null }>;
}

const words = (value: string) => value.replace(/_/g, ' ');

/** Every step on one property, for the pro, with which ones the homeowner sees. */
export function buildProPropertyTimeline(data: ProHistory, crmBase: string): TimelineStep[] {
  const steps: TimelineStep[] = [];
  const invoiceNumber = new Map(data.invoices.map((row) => [row.id, row.invoice_number || row.display_id]));
  const planName = new Map(data.plans.map((row) => [row.id, row.name]));

  for (const row of data.estimates) {
    const area = row.job_area ? ` · ${row.job_area}` : '';
    const href = `${crmBase}/estimates?id=${row.id}`;
    const draft = row.status === 'draft';
    steps.push({
      id: `estimate-${row.id}`,
      kind: 'estimate',
      at: row.created_at,
      title: draft ? `Estimate drafted${area}` : `Estimate sent${area}`,
      detail: `#${row.display_id}`,
      amountCents: row.amount_cents,
      href,
      customerSees: !draft,
    });
    if (row.status === 'accepted') {
      steps.push({
        id: `approved-${row.id}`,
        kind: 'approved',
        at: row.signed_at || row.updated_at || row.created_at,
        title: `Estimate approved${area}`,
        detail: row.signer_name ? `#${row.display_id} · signed by ${row.signer_name}` : `#${row.display_id} · marked approved`,
        amountCents: row.amount_cents,
        href,
        customerSees: true,
        by: row.signer_name ? 'customer' : 'pro',
      });
    } else if (row.status === 'declined') {
      steps.push({
        id: `declined-${row.id}`,
        kind: 'declined',
        at: row.updated_at || row.created_at,
        title: `Estimate declined${area}`,
        detail: `#${row.display_id}`,
        amountCents: row.amount_cents,
        href,
        customerSees: true,
        by: 'customer',
      });
    }
  }

  const events = data.invoiceEvents ?? [];
  const sentEvents = new Map<string, string[]>();
  for (const event of events) {
    if (event.action !== 'sent') continue;
    sentEvents.set(event.invoice_id, [...(sentEvents.get(event.invoice_id) ?? []), event.created_at]);
  }
  const amountOf = new Map(data.invoices.map((row) => [row.id, row.amount_cents]));

  for (const row of data.invoices) {
    const draft = row.status === 'draft';
    const href = `${crmBase}/invoices/${row.id}`;
    const sends = sentEvents.get(row.id) ?? [];
    // A cancelled invoice that never went out is the pro's own business.
    if (row.status === 'cancelled' && sends.length === 0) continue;
    steps.push({
      id: `invoice-${row.id}`,
      kind: 'invoice',
      // The first real send, when it was logged; else when the invoice was made.
      at: sends[0] || row.created_at || row.invoice_date,
      title: draft ? 'Invoice drafted' : 'Invoice sent',
      detail: row.invoice_number || row.display_id,
      amountCents: row.amount_cents,
      href,
      customerSees: !draft,
    });
  }

  for (const event of events) {
    const number = invoiceNumber.get(event.invoice_id) ?? '';
    const href = `${crmBase}/invoices/${event.invoice_id}`;
    const payload = (event.payload && typeof event.payload === 'object' ? event.payload : {}) as Record<string, unknown>;
    const base = { id: `event-${event.id}`, at: event.created_at, href };
    if (event.action === 'sent' && sentEvents.get(event.invoice_id)?.[0] !== event.created_at) {
      steps.push({ ...base, kind: 'invoice', title: 'Invoice sent again', detail: number, amountCents: amountOf.get(event.invoice_id), customerSees: true });
    } else if (event.action === 'reminded') {
      const auto = payload.kind === 'due_soon' ? 'Due soon reminder sent' : payload.kind === 'manual' ? 'Payment reminder sent' : 'Overdue reminder sent';
      const to = typeof payload.to === 'string' ? ` · to ${payload.to}` : '';
      const late = typeof payload.days_overdue === 'number' && payload.days_overdue > 0 ? ` · ${payload.days_overdue} days late` : '';
      steps.push({ ...base, kind: 'reminder', title: auto, detail: `${number}${late}${to}`, customerSees: true });
    } else if (event.action === 'cancelled') {
      steps.push({ ...base, kind: 'invoice', title: 'Invoice cancelled', detail: number, customerSees: true });
    } else if (event.action === 'payment_voided') {
      const cents = typeof payload.amount_cents === 'number' ? payload.amount_cents : null;
      steps.push({ ...base, kind: 'payment', title: 'Payment voided', detail: `invoice ${number}`, amountCents: cents, customerSees: true });
    }
  }

  for (const row of data.payments) {
    steps.push({
      id: `payment-${row.id}`,
      kind: 'payment',
      at: row.payment_date,
      title: 'Payment received',
      detail: `${words(row.method)} · invoice ${invoiceNumber.get(row.invoice_id) ?? ''}`.trim(),
      amountCents: row.amount_cents,
      href: `${crmBase}/invoices/${row.invoice_id}`,
      customerSees: true,
      // Paid online by the customer; cash, check and the like the pro recorded.
      by: /card|stripe|online|ach|link/i.test(row.method) ? 'customer' : 'pro',
    });
  }
  // Paid in full, on the day of its last payment.
  for (const row of data.invoices.filter((invoice) => invoice.status === 'paid')) {
    const last = data.payments
      .filter((payment) => payment.invoice_id === row.id)
      .map((payment) => payment.payment_date)
      .sort()
      .pop();
    steps.push({
      id: `paid-${row.id}`,
      kind: 'paid',
      at: last || row.invoice_date,
      title: 'Invoice paid in full',
      detail: row.invoice_number || row.display_id,
      amountCents: row.amount_cents,
      href: `${crmBase}/invoices/${row.id}`,
      customerSees: true,
    });
  }

  for (const row of data.projects) {
    const shared = row.shared !== false;
    if (row.start_date) {
      steps.push({
        id: `project-${row.id}`,
        kind: 'project',
        at: row.start_date,
        title: `Project started · ${row.name}`,
        detail: words(row.status),
        href: `${crmBase}/projects/${row.id}`,
        customerSees: shared,
      });
    }
    if (row.status === 'completed' && row.end_date) {
      steps.push({
        id: `project-done-${row.id}`,
        kind: 'project_done',
        at: row.end_date,
        title: `Project finished · ${row.name}`,
        href: `${crmBase}/projects/${row.id}`,
        customerSees: shared,
      });
    }
  }

  for (const row of data.plans) {
    if (!row.created_at) continue;
    steps.push({
      id: `plan-${row.id}`,
      kind: 'maintenance',
      at: row.created_at,
      title: `Maintenance started · ${row.name}`,
      detail: `${words(row.frequency)}${row.is_active ? '' : ' · ended'}`,
      href: `${crmBase}/maintenance/houses/${row.id}`,
      customerSees: true,
    });
  }

  for (const row of data.visits.filter((visit) => visit.status === 'completed')) {
    const seconds = row.labor_seconds ?? row.duration_seconds ?? 0;
    const plan = row.maintenance_plan_id ? planName.get(row.maintenance_plan_id) : null;
    steps.push({
      id: `visit-${row.id}`,
      kind: 'visit',
      at: row.ended_at || row.started_at,
      title: 'Maintenance visit done',
      detail: [plan, seconds > 0 ? `${(seconds / 3600).toFixed(1)}h labor` : null].filter(Boolean).join(' · ') || null,
      customerSees: true,
    });
  }

  for (const row of data.documents) {
    steps.push({
      id: `document-${row.id}`,
      kind: 'document',
      at: row.created_at,
      title: row.visible_to_customer === false ? 'File added' : 'File shared',
      detail: row.title,
      customerSees: row.visible_to_customer !== false,
    });
  }

  const estimateNumber = new Map(data.estimates.map((row) => [row.id, row.display_id]));
  for (const row of data.activity ?? []) {
    const base = { id: `activity-${row.id}`, at: row.occurred_at };
    if (row.kind === 'estimate_sent' && row.estimate_id) {
      steps.push({ ...base, kind: 'estimate', title: 'Estimate emailed', detail: [`#${estimateNumber.get(row.estimate_id) ?? ''}`, row.detail ? `to ${row.detail}` : null].filter(Boolean).join(' · '), href: `${crmBase}/estimates?id=${row.estimate_id}`, customerSees: true });
    } else if (row.kind === 'estimate_viewed' && row.estimate_id) {
      steps.push({ ...base, kind: 'viewed', title: 'Customer opened the estimate', detail: `#${estimateNumber.get(row.estimate_id) ?? ''}`, href: `${crmBase}/estimates?id=${row.estimate_id}`, customerSees: true, by: 'customer', tab: 'estimates' });
    } else if (row.kind === 'invoice_viewed' && row.invoice_id) {
      steps.push({ ...base, kind: 'viewed', title: 'Customer opened the invoice', detail: invoiceNumber.get(row.invoice_id) ?? '', href: `${crmBase}/invoices/${row.invoice_id}`, customerSees: true, by: 'customer', tab: 'invoices' });
    } else if (row.kind === 'statement_sent') {
      steps.push({ ...base, kind: 'invoice', title: 'Statement emailed', detail: row.detail ? `to ${row.detail}` : null, customerSees: true });
    }
  }

  for (const row of data.bookings ?? []) {
    const service = row.service_name ? ` · ${row.service_name}` : '';
    const when = new Date(row.slot_start_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    steps.push({ id: `booking-${row.id}`, kind: 'appointment', at: row.created_at, title: `Appointment booked${service}`, detail: when, customerSees: true, by: 'customer', href: `${crmBase}/calendar` });
    if (row.status === 'cancelled') {
      steps.push({ id: `booking-cancel-${row.id}`, kind: 'appointment', at: row.updated_at || row.created_at, title: `Appointment cancelled${service}`, detail: when, customerSees: true, by: 'customer' });
    } else if (row.status === 'completed') {
      steps.push({ id: `booking-done-${row.id}`, kind: 'visit', at: row.slot_start_at, title: `Appointment done${service}`, detail: when, customerSees: true, tab: 'appointments' });
    }
  }

  return sortSteps(steps);
}
