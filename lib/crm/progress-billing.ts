/** Statuses that still hold part of an estimate. A cancelled invoice gives the amount back. */
const HOLDING_STATUSES = new Set(['draft', 'sent', 'partial', 'paid', 'overdue']);

export interface ProgressLine {
  product_or_service?: string | null;
  description?: string | null;
  unit?: string | null;
  qty?: number | null;
  rate_cents?: number | null;
  amount_cents?: number | null;
}

export interface ProgressInvoiceDraft {
  amountCents: number;
  lineItems: ProgressLine[] | null;
  note: string | null;
  remainingAfterCents: number;
}

function usd(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

export function contractBilledCents(invoices: Array<{ status: string; amount_cents: number }>): number {
  return invoices.reduce((sum, invoice) => {
    if (!HOLDING_STATUSES.has(invoice.status)) return sum;
    return sum + Math.max(0, Number(invoice.amount_cents) || 0);
  }, 0);
}

export function contractRemainingCents(contractCents: number, billedCents: number): number {
  return Math.max(0, contractCents - billedCents);
}

function asLines(value: unknown): ProgressLine[] {
  if (!Array.isArray(value)) return [];
  return value.filter((line): line is ProgressLine => Boolean(line) && typeof line === 'object');
}

/** Scale estimate lines so they add up to `billCents`. The last line absorbs rounding. */
export function scaleContractLines(lines: unknown, billCents: number): ProgressLine[] {
  const parsed = asLines(lines).filter((line) => (line.amount_cents ?? 0) > 0 || line.description || line.product_or_service);
  if (billCents <= 0) return [];
  if (parsed.length === 0) {
    return [
      {
        product_or_service: 'Progress billing',
        description: 'Portion of the estimate',
        unit: null,
        qty: 1,
        rate_cents: billCents,
        amount_cents: billCents,
      },
    ];
  }

  const base = parsed.reduce((sum, line) => sum + Math.max(0, Number(line.amount_cents) || 0), 0);
  if (base <= 0) {
    return [
      {
        ...parsed[0],
        qty: 1,
        rate_cents: billCents,
        amount_cents: billCents,
      },
    ];
  }

  let allocated = 0;
  return parsed.map((line, index) => {
    const isLast = index === parsed.length - 1;
    const share = Math.max(0, Number(line.amount_cents) || 0);
    const amount = isLast ? billCents - allocated : Math.round((share / base) * billCents);
    allocated += amount;
    return {
      ...line,
      qty: 1,
      rate_cents: amount,
      amount_cents: amount,
    };
  });
}

/**
 * Turn an estimate into the next invoice.
 * Omit `requestedCents` to bill whatever is still open.
 */
export function buildProgressInvoice(input: {
  contractCents: number;
  billedCents: number;
  requestedCents?: number | null;
  lineItems: unknown;
  note: string | null;
}): { error: string } | ProgressInvoiceDraft {
  const contractCents = Math.max(0, input.contractCents);
  const billedCents = Math.max(0, input.billedCents);
  const remaining = contractRemainingCents(contractCents, billedCents);
  if (remaining <= 0) return { error: 'This estimate is fully billed' };

  const requested = input.requestedCents;
  let amountCents = remaining;
  if (requested != null) {
    if (!Number.isInteger(requested) || requested <= 0) return { error: 'Enter an amount to bill' };
    if (requested > remaining) return { error: 'That amount is more than the remaining balance' };
    amountCents = requested;
  }

  const fullFirstInvoice = billedCents === 0 && amountCents === contractCents;
  const lineItems = fullFirstInvoice ? asLines(input.lineItems) : scaleContractLines(input.lineItems, amountCents);
  const remainingAfterCents = remaining - amountCents;
  const note = fullFirstInvoice
    ? input.note
    : [
        input.note,
        `Progress billing of ${usd(amountCents)}. ${usd(remainingAfterCents)} of ${usd(contractCents)} remains on the estimate.`,
      ]
        .filter((part) => part && part.trim())
        .join('\n\n');

  return {
    amountCents,
    lineItems: lineItems.length > 0 ? lineItems : null,
    note,
    remainingAfterCents,
  };
}
