/** Open estimates, unpaid invoices, and recent payments for the contacts list. */

export const RECENT_PAYMENT_DAYS = 30;

export interface MoneyBucket {
  count: number;
  cents: number;
}

export interface ContactBooksSummary {
  estimates: MoneyBucket;
  overdue: MoneyBucket;
  openInvoices: MoneyBucket;
  recentlyPaid: MoneyBucket;
}

export interface InvoiceMoney {
  customerId?: string;
  status: string;
  amountCents: number;
  paidCents: number;
}

export interface EstimateMoney {
  status: string;
  amountCents: number;
}

export interface PaymentMoney {
  amountCents: number;
  paymentDate: string;
  voided: boolean;
}

export interface ContactTransaction {
  id: string;
  kind: 'estimate' | 'invoice' | 'payment';
  date: string;
  number: string;
  amountCents: number;
  status: string;
  recordId: string;
}

const OPEN_ESTIMATE = new Set(['draft', 'sent']);
const UNPAID_INVOICE = new Set(['sent', 'partial', 'overdue']);

export function balanceCents(amountCents: number, paidCents: number): number {
  return Math.max(0, Math.round(amountCents) - Math.round(paidCents));
}

export function daysBefore(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.slice(0, 10).split('-').map(Number);
  const date = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export function summarizeBooks(
  invoices: InvoiceMoney[],
  estimates: EstimateMoney[],
  payments: PaymentMoney[],
  today: string
): ContactBooksSummary {
  const estimateBucket: MoneyBucket = { count: 0, cents: 0 };
  for (const estimate of estimates) {
    if (!OPEN_ESTIMATE.has(estimate.status)) continue;
    estimateBucket.count += 1;
    estimateBucket.cents += estimate.amountCents;
  }

  const overdue: MoneyBucket = { count: 0, cents: 0 };
  const openInvoices: MoneyBucket = { count: 0, cents: 0 };
  for (const invoice of invoices) {
    const balance = balanceCents(invoice.amountCents, invoice.paidCents);
    if (balance <= 0) continue;
    if (invoice.status === 'overdue') {
      overdue.count += 1;
      overdue.cents += balance;
    } else if (invoice.status === 'sent' || invoice.status === 'partial') {
      openInvoices.count += 1;
      openInvoices.cents += balance;
    }
  }

  const cutoff = daysBefore(today, RECENT_PAYMENT_DAYS);
  const recentlyPaid: MoneyBucket = { count: 0, cents: 0 };
  for (const payment of payments) {
    if (payment.voided) continue;
    const paidOn = payment.paymentDate.slice(0, 10);
    if (paidOn < cutoff) continue;
    recentlyPaid.count += 1;
    recentlyPaid.cents += payment.amountCents;
  }

  return { estimates: estimateBucket, overdue, openInvoices, recentlyPaid };
}

export function openBalanceByCustomer(invoices: Array<InvoiceMoney & { customerId: string }>): Map<string, number> {
  const totals = new Map<string, number>();
  for (const invoice of invoices) {
    if (!UNPAID_INVOICE.has(invoice.status)) continue;
    const balance = balanceCents(invoice.amountCents, invoice.paidCents);
    if (balance <= 0) continue;
    totals.set(invoice.customerId, (totals.get(invoice.customerId) ?? 0) + balance);
  }
  return totals;
}

export function buildContactActivity(input: {
  invoices: Array<InvoiceMoney & { id: string; number: string; date: string }>;
  estimates: Array<EstimateMoney & { id: string; number: string; date: string }>;
  payments: Array<{ id: string; invoiceId: string; invoiceNumber: string; amountCents: number; date: string; method: string }>;
}): { openBalanceCents: number; overdueCents: number; transactions: ContactTransaction[] } {
  let openBalanceCents = 0;
  let overdueCents = 0;
  const transactions: ContactTransaction[] = [];

  for (const invoice of input.invoices) {
    const balance = balanceCents(invoice.amountCents, invoice.paidCents);
    if (UNPAID_INVOICE.has(invoice.status) && balance > 0) {
      openBalanceCents += balance;
      if (invoice.status === 'overdue') overdueCents += balance;
    }
    transactions.push({
      id: `invoice-${invoice.id}`,
      kind: 'invoice',
      date: invoice.date.slice(0, 10),
      number: invoice.number,
      amountCents: invoice.amountCents,
      status: invoice.status,
      recordId: invoice.id,
    });
  }

  for (const estimate of input.estimates) {
    transactions.push({
      id: `estimate-${estimate.id}`,
      kind: 'estimate',
      date: estimate.date.slice(0, 10),
      number: estimate.number,
      amountCents: estimate.amountCents,
      status: estimate.status,
      recordId: estimate.id,
    });
  }

  for (const payment of input.payments) {
    transactions.push({
      id: `payment-${payment.id}`,
      kind: 'payment',
      date: payment.date.slice(0, 10),
      number: payment.invoiceNumber,
      amountCents: payment.amountCents,
      status: payment.method,
      recordId: payment.invoiceId,
    });
  }

  transactions.sort((a, b) => b.date.localeCompare(a.date) || a.kind.localeCompare(b.kind));
  return { openBalanceCents, overdueCents, transactions: transactions.slice(0, 40) };
}
