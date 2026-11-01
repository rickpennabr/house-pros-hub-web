export const PRO_INVOICE_STATUSES = ['draft', 'sent', 'partial', 'paid', 'overdue', 'cancelled'] as const;

export type ProInvoiceStatus = (typeof PRO_INVOICE_STATUSES)[number];

export const PAYMENT_METHODS = ['cash', 'check', 'card', 'transfer', 'other'] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const RECURRING_FREQUENCIES = ['weekly', 'biweekly', 'monthly', 'yearly'] as const;

export type RecurringFrequency = (typeof RECURRING_FREQUENCIES)[number];

export type AgingBucket = 'current' | 'days1to30' | 'days31to60' | 'days61to90' | 'days90plus';

export function todayDateKey(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function invoiceStatusLabel(status: string): string {
  switch (status) {
    case 'draft':
      return 'Draft';
    case 'sent':
      return 'Sent';
    case 'partial':
      return 'Partial';
    case 'paid':
      return 'Paid';
    case 'overdue':
      return 'Overdue';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
}

export function activePaidCents(payments: Array<{ amount_cents: number; voided_at?: string | null }>): number {
  return payments.reduce((sum, payment) => {
    if (payment.voided_at) return sum;
    return sum + (Number(payment.amount_cents) || 0);
  }, 0);
}

export function canRecordPayment(status: ProInvoiceStatus): boolean {
  return status === 'sent' || status === 'partial' || status === 'overdue';
}

export function canCancelInvoice(status: ProInvoiceStatus, activePaymentCount: number): boolean {
  return status !== 'paid' && status !== 'cancelled' && activePaymentCount === 0;
}

/** Stored status after a payment or void. Cancelled stays cancelled. */
export function statusFromPayments(input: {
  storedStatus: ProInvoiceStatus;
  dueDate: string | null;
  totalCents: number;
  paidCents: number;
  today?: string;
}): ProInvoiceStatus {
  if (input.storedStatus === 'cancelled') return 'cancelled';
  const today = input.today ?? todayDateKey();
  const paid = input.paidCents;
  const total = input.totalCents;
  if (paid > 0 && paid >= total) return 'paid';

  const pastDue =
    input.storedStatus !== 'draft' && Boolean(input.dueDate) && (input.dueDate as string) < today;

  if (paid > 0 && paid < total) return pastDue ? 'overdue' : 'partial';
  if (pastDue) return 'overdue';
  if (input.storedStatus === 'draft') return 'draft';
  return 'sent';
}

export function daysPastDue(dueDate: string, today: string): number {
  const due = Date.parse(`${dueDate}T00:00:00`);
  const now = Date.parse(`${today}T00:00:00`);
  return Math.round((now - due) / 86_400_000);
}

export function agingBucket(dueDate: string | null, today: string): AgingBucket {
  if (!dueDate || dueDate >= today) return 'current';
  const days = daysPastDue(dueDate, today);
  if (days <= 30) return 'days1to30';
  if (days <= 60) return 'days31to60';
  if (days <= 90) return 'days61to90';
  return 'days90plus';
}

export function nextRecurringDate(from: string, frequency: RecurringFrequency): string {
  if (frequency === 'weekly') return addDays(from, 7);
  if (frequency === 'biweekly') return addDays(from, 14);
  if (frequency === 'yearly') return addDays(from, 365);
  const date = new Date(`${from}T12:00:00`);
  date.setMonth(date.getMonth() + 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + days);
  return todayDateKey(date);
}
