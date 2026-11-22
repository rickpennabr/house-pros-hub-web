/**
 * A discount on an estimate or invoice, as in QuickBooks: a percent of the subtotal or a dollar
 * amount. The lines keep their full prices; the document's amount_cents is the subtotal minus
 * the discount, so payments, deposits and charts all use the discounted total.
 */

export type DiscountKind = 'percent' | 'amount';

export interface DocumentDiscount {
  kind: DiscountKind;
  /** Percent (0–100) or dollars. */
  value: number;
}

/** Columns added in 159_document_discounts. */
export interface DiscountColumns {
  discount_kind: DiscountKind | null;
  discount_value: number;
  discount_cents: number;
}

export const NO_DISCOUNT_COLUMNS: DiscountColumns = { discount_kind: null, discount_value: 0, discount_cents: 0 };

/** Cents taken off the subtotal. Never more than the subtotal. */
export function discountCents(subtotalCents: number, discount: DocumentDiscount | null | undefined): number {
  const subtotal = Math.max(0, Math.round(subtotalCents) || 0);
  if (!discount || !(discount.value > 0)) return 0;
  const raw = discount.kind === 'percent' ? (subtotal * Math.min(100, discount.value)) / 100 : discount.value * 100;
  return Math.min(subtotal, Math.max(0, Math.round(raw)));
}

/** The total after the discount. */
export function discountedTotalCents(subtotalCents: number, discount: DocumentDiscount | null | undefined): number {
  return Math.max(0, Math.round(subtotalCents) - discountCents(subtotalCents, discount));
}

/** The discount sent by a form: `{ kind, value }` or null for none. */
export function readDiscount(raw: unknown): { ok: true; discount: DocumentDiscount | null } | { ok: false; error: string } {
  if (raw === null || raw === undefined || raw === '') return { ok: true, discount: null };
  if (typeof raw !== 'object') return { ok: false, error: 'Enter a valid discount' };
  const row = raw as { kind?: unknown; value?: unknown };
  const kind = row.kind === 'percent' || row.kind === 'amount' ? row.kind : null;
  const value = typeof row.value === 'number' ? row.value : Number(row.value);
  if (!kind || !Number.isFinite(value) || value < 0) return { ok: false, error: 'Enter a valid discount' };
  if (kind === 'percent' && value > 100) return { ok: false, error: 'A discount cannot be more than 100%' };
  if (value === 0) return { ok: true, discount: null };
  return { ok: true, discount: { kind, value: Math.round(value * 100) / 100 } };
}

export function discountColumns(subtotalCents: number, discount: DocumentDiscount | null): DiscountColumns {
  if (!discount) return NO_DISCOUNT_COLUMNS;
  return { discount_kind: discount.kind, discount_value: discount.value, discount_cents: discountCents(subtotalCents, discount) };
}

/** The saved discount on a row (null before the migration or when there is none). */
export function discountFromRow(row: unknown): DocumentDiscount | null {
  if (!row || typeof row !== 'object') return null;
  const value = Number((row as { discount_value?: unknown }).discount_value);
  const kind = (row as { discount_kind?: unknown }).discount_kind;
  if ((kind !== 'percent' && kind !== 'amount') || !(value > 0)) return null;
  return { kind, value };
}

/** Saved discount cents on a row, 0 when none. */
export function discountCentsFromRow(row: unknown): number {
  if (!row || typeof row !== 'object') return 0;
  const cents = Number((row as { discount_cents?: unknown }).discount_cents);
  return Number.isFinite(cents) && cents > 0 ? Math.round(cents) : 0;
}

/** "Discount (10%)" or "Discount". */
export function discountLabel(discount: DocumentDiscount | null | undefined): string {
  if (discount?.kind === 'percent') return `Discount (${discount.value}%)`;
  return 'Discount';
}

/** Form text ("10", "25.50") into a discount, or null for none. */
export function discountFromForm(kind: DiscountKind, text: string): DocumentDiscount | null {
  const value = Number(text.trim());
  if (!text.trim() || !Number.isFinite(value) || value <= 0) return null;
  return { kind, value: kind === 'percent' ? Math.min(100, value) : value };
}

/** A saved discount back into form text. */
export function discountFormText(discount: DocumentDiscount | null | undefined): string {
  if (!discount) return '';
  return discount.kind === 'percent' ? String(discount.value) : discount.value.toFixed(2);
}

/** True when a write failed because the discount columns are not in the database yet. */
export function isMissingDiscountColumn(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return (
    error.code === 'PGRST204' || error.code === '42703' || /discount_(kind|value|cents)/.test(error.message ?? '')
  ) && /discount/.test(error.message ?? '');
}

export const DISCOUNT_MIGRATION_ERROR =
  'Discounts need the database update 159_document_discounts. Apply it, then save again.';

/** Sum of the saved line amounts (line_items JSON). */
export function lineSubtotalCents(lines: unknown): number {
  if (!Array.isArray(lines)) return 0;
  return lines.reduce((sum: number, line) => {
    const cents = Number((line as { amount_cents?: unknown } | null)?.amount_cents);
    return sum + (Number.isFinite(cents) ? Math.max(0, Math.round(cents)) : 0);
  }, 0);
}

/**
 * The discount to show on a saved document: what its full-price lines add up to beyond the total.
 * Progress and deposit invoices scale their lines to the amount billed, so they show none.
 */
export function shownDiscount(lines: unknown, totalCents: number): { subtotalCents: number; discountCents: number } | null {
  const subtotal = lineSubtotalCents(lines);
  const discount = subtotal - Math.max(0, Math.round(totalCents) || 0);
  return subtotal > 0 && discount > 0 ? { subtotalCents: subtotal, discountCents: discount } : null;
}
