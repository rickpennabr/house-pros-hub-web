import { resolveInvoiceDueDate } from '@/lib/invoices/invoiceDueOnReceipt';

/**
 * Where an invoice stands on payment, worked out from its status, dates and balance.
 * A sent invoice that is "due on receipt" is due on its invoice date, so a day later it is overdue.
 */
export type InvoiceDueKind = 'draft' | 'cancelled' | 'paid' | 'upcoming' | 'due_today' | 'overdue';

export interface InvoiceDueState {
  kind: InvoiceDueKind;
  /** YYYY-MM-DD, null when unknown. */
  dueDate: string | null;
  /** Days past the due date (overdue only). */
  daysOverdue: number;
  /** Days until due (upcoming only). */
  daysLeft: number;
  balanceCents: number;
  /** True when a payment reminder makes sense: sent, money still owed, due today or late. */
  canRemind: boolean;
}

export interface InvoiceDueInput {
  status: string;
  invoice_date: string | null;
  due_date: string | null;
  payment_terms?: string | null;
  amount_cents: number;
  payment_applied_cents?: number | null;
}

/** Local calendar day "YYYY-MM-DD". */
function todayKey(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dayDiff(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function invoiceDueState(invoice: InvoiceDueInput, now = new Date()): InvoiceDueState {
  const balanceCents = Math.max(0, invoice.amount_cents - (invoice.payment_applied_cents ?? 0));
  const dueDate = resolveInvoiceDueDate(invoice.invoice_date, invoice.due_date, invoice.payment_terms)?.slice(0, 10) ?? null;
  const base = { dueDate, daysOverdue: 0, daysLeft: 0, balanceCents, canRemind: false };
  if (invoice.status === 'draft') return { ...base, kind: 'draft' };
  if (invoice.status === 'cancelled') return { ...base, kind: 'cancelled' };
  if (invoice.status === 'paid' || balanceCents === 0) return { ...base, kind: 'paid' };
  if (!dueDate) return { ...base, kind: 'upcoming' };
  const diff = dayDiff(todayKey(now), dueDate);
  if (diff > 0) return { ...base, kind: 'upcoming', daysLeft: diff };
  if (diff === 0) return { ...base, kind: 'due_today', canRemind: true };
  return { ...base, kind: 'overdue', daysOverdue: -diff, canRemind: true };
}

/** Short label for lists: "Overdue 2 days · Nov 21, 2026", "Due today", "Due in 5 days · Dec 1, 2026". */
export function invoiceDueLabel(state: InvoiceDueState, formatDate: (iso: string | null) => string): string {
  // Noon so a plain date never shifts a day in US timezones.
  const date = state.dueDate ? formatDate(`${state.dueDate}T12:00:00`) : '—';
  switch (state.kind) {
    case 'overdue':
      return `Overdue ${state.daysOverdue} ${state.daysOverdue === 1 ? 'day' : 'days'} · ${date}`;
    case 'due_today':
      return 'Due today';
    case 'upcoming':
      return state.daysLeft > 0 ? `Due in ${state.daysLeft} ${state.daysLeft === 1 ? 'day' : 'days'} · ${date}` : date;
    case 'paid':
      return 'Paid';
    default:
      return date;
  }
}

/** Status to show: a sent or partial invoice past its due date reads "overdue". */
export function effectiveInvoiceStatus(invoice: InvoiceDueInput, now = new Date()): string {
  const state = invoiceDueState(invoice, now);
  if (state.kind === 'overdue' && (invoice.status === 'sent' || invoice.status === 'partial')) return 'overdue';
  return invoice.status;
}
