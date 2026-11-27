/** Totals behind the indicator cards on the CRM invoices and projects lists. */

export type InvoiceCardKey = 'draft' | 'sent' | 'overdue' | 'paid';
export type InvoiceSummary = Record<InvoiceCardKey, { count: number; cents: number }>;

export function summarizeInvoices(
  rows: Array<{ status: string; amount_cents: number; payment_applied_cents: number | null; due_date: string | null; invoice_date: string }>,
  today: string
): InvoiceSummary {
  const summary: InvoiceSummary = { draft: { count: 0, cents: 0 }, sent: { count: 0, cents: 0 }, overdue: { count: 0, cents: 0 }, paid: { count: 0, cents: 0 } };
  for (const row of rows) {
    const balance = Math.max(0, row.amount_cents - (row.payment_applied_cents ?? 0));
    if (row.status === 'draft') {
      summary.draft.count += 1;
      summary.draft.cents += row.amount_cents;
    } else if (row.status === 'paid') {
      summary.paid.count += 1;
      summary.paid.cents += row.amount_cents;
    } else if (row.status === 'sent' || row.status === 'partial' || row.status === 'overdue') {
      // Same rule as the Overdue filter: past the due date (due on receipt: past the invoice date).
      const late = row.status === 'overdue' || (row.due_date ? row.due_date < today : row.invoice_date < today);
      const bucket = late ? summary.overdue : summary.sent;
      bucket.count += 1;
      bucket.cents += balance;
    }
  }
  return summary;
}

export type ProjectCardKey = 'planned' | 'in_progress' | 'on_hold' | 'completed';
export type ProjectSummary = Record<ProjectCardKey, { count: number; next: string | null }>;

export function summarizeProjects(rows: Array<{ status: string; start_date: string | null; end_date: string | null }>, today: string): ProjectSummary {
  const summary: ProjectSummary = {
    planned: { count: 0, next: null },
    in_progress: { count: 0, next: null },
    on_hold: { count: 0, next: null },
    completed: { count: 0, next: null },
  };
  for (const row of rows) {
    if (!(row.status in summary)) continue;
    const bucket = summary[row.status as ProjectCardKey];
    bucket.count += 1;
    // Planned: the next start date. In progress: the next finish date.
    const date = row.status === 'planned' ? row.start_date : row.status === 'in_progress' ? row.end_date : null;
    if (date && date >= today && (!bucket.next || date < bucket.next)) bucket.next = date;
  }
  return summary;
}

export interface ExpenseSummary {
  thisMonth: { count: number; cents: number };
  lastMonth: { count: number; cents: number };
  thisYear: { count: number; cents: number };
  /** Job costs on a project, not on an invoice yet. */
  notBilled: { count: number; cents: number };
}

export function summarizeExpenses(
  rows: Array<{ amount_cents: number; expense_date: string; project_id: string | null; billed_invoice_id: string | null }>,
  today: string
): ExpenseSummary {
  const month = today.slice(0, 7);
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  const lastMonth = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
  const add = (b: { count: number; cents: number }, cents: number) => { b.count += 1; b.cents += cents; };
  const sum: ExpenseSummary = { thisMonth: { count: 0, cents: 0 }, lastMonth: { count: 0, cents: 0 }, thisYear: { count: 0, cents: 0 }, notBilled: { count: 0, cents: 0 } };
  for (const row of rows) {
    const ym = row.expense_date.slice(0, 7);
    if (ym === month) add(sum.thisMonth, row.amount_cents);
    if (ym === lastMonth) add(sum.lastMonth, row.amount_cents);
    if (row.expense_date.slice(0, 4) === String(y)) add(sum.thisYear, row.amount_cents);
    if (row.project_id && !row.billed_invoice_id) add(sum.notBilled, row.amount_cents);
  }
  return sum;
}
