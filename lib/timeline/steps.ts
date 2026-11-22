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
      });
    }
  }

  for (const row of data.invoices) {
    if (row.status === 'cancelled') continue;
    const draft = row.status === 'draft';
    const href = `${crmBase}/invoices/${row.id}`;
    steps.push({
      id: `invoice-${row.id}`,
      kind: 'invoice',
      at: row.created_at || row.invoice_date,
      title: draft ? 'Invoice drafted' : 'Invoice sent',
      detail: row.invoice_number || row.display_id,
      amountCents: row.amount_cents,
      href,
      customerSees: !draft,
    });
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

  return sortSteps(steps);
}
