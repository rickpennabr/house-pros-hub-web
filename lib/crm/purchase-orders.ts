/** Purchase orders: totals, status rules, and receiving. Pure logic, shared by the API and the pages. */

export const PO_STATUSES = ['draft', 'sent', 'confirmed', 'partial', 'received', 'closed', 'cancelled'] as const;
export type PoStatus = (typeof PO_STATUSES)[number];

/** Statuses where money is committed but not all goods are in. */
export const OPEN_PO_STATUSES: PoStatus[] = ['sent', 'confirmed', 'partial'];

export interface PoLineInput {
  description: string;
  quantity: number;
  unit: string;
  unitPriceCents: number;
  materialId: string | null;
}

export interface PoLine extends PoLineInput {
  id: string;
  receivedQty: number;
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const round2 = (n: number) => Math.round(n * 100) / 100;

export function formatPoNumber(prefix: string | null | undefined, next: number): string {
  return `${(prefix || 'PO').trim() || 'PO'}-${String(Math.max(1, Math.floor(next))).padStart(4, '0')}`;
}

export function lineTotalCents(line: Pick<PoLineInput, 'quantity' | 'unitPriceCents'>): number {
  return Math.round(line.quantity * line.unitPriceCents);
}

export function poTotals(
  lines: Pick<PoLineInput, 'quantity' | 'unitPriceCents'>[],
  taxCents = 0,
  shippingCents = 0
): { subtotalCents: number; totalCents: number } {
  const subtotalCents = lines.reduce((sum, line) => sum + lineTotalCents(line), 0);
  return { subtotalCents, totalCents: subtotalCents + Math.max(0, taxCents) + Math.max(0, shippingCents) };
}

/** Validate one line from a form or API body. Quantities accept a comma decimal. */
export function parsePoLine(raw: unknown): Result<PoLineInput> {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Invalid line' };
  const r = raw as Record<string, unknown>;
  const description = typeof r.description === 'string' ? r.description.trim() : '';
  if (!description) return { ok: false, error: 'Each line needs an item' };
  if (description.length > 300) return { ok: false, error: 'Item is too long' };
  const quantity = Number(String(r.quantity ?? '').replace(',', '.'));
  if (!Number.isFinite(quantity) || quantity <= 0) return { ok: false, error: 'Quantity must be more than 0' };
  const unitPriceCents = Math.round(Number(r.unitPriceCents ?? 0));
  if (!Number.isFinite(unitPriceCents) || unitPriceCents < 0) return { ok: false, error: 'Invalid price' };
  const unit = typeof r.unit === 'string' && r.unit.trim() ? r.unit.trim().slice(0, 40) : 'Each';
  const materialId = typeof r.materialId === 'string' && r.materialId ? r.materialId : null;
  return { ok: true, value: { description, quantity: round2(quantity), unit, unitPriceCents, materialId } };
}

/** Lines can be edited only before the supplier has shipped anything. */
export function canEditLines(status: PoStatus): boolean {
  return status === 'draft' || status === 'sent' || status === 'confirmed';
}

export function canReceive(status: PoStatus): boolean {
  return status === 'sent' || status === 'confirmed' || status === 'partial';
}

/** Status after receiving: partial until every line is fully in. */
export function statusAfterReceiving(lines: Pick<PoLine, 'quantity' | 'receivedQty'>[]): PoStatus {
  const anyIn = lines.some((line) => line.receivedQty > 0);
  const allIn = lines.length > 0 && lines.every((line) => line.receivedQty >= line.quantity);
  return allIn ? 'received' : anyIn ? 'partial' : 'confirmed';
}

export interface ReceiptLine {
  lineId: string;
  quantity: number;
}

/**
 * Check a delivery against the PO. Returns, per line, the quantity taken and its cost.
 * Receiving more than ordered is allowed (suppliers send extra) but never a negative amount.
 */
export function planReceipt(
  lines: PoLine[],
  receipt: ReceiptLine[]
): Result<{ lineId: string; quantity: number; costCents: number; line: PoLine }[]> {
  const byId = new Map(lines.map((line) => [line.id, line]));
  const out: { lineId: string; quantity: number; costCents: number; line: PoLine }[] = [];
  for (const item of receipt) {
    const line = byId.get(item.lineId);
    if (!line) return { ok: false, error: 'Unknown line' };
    const quantity = round2(Number(item.quantity));
    if (!Number.isFinite(quantity) || quantity < 0) return { ok: false, error: 'Invalid quantity' };
    if (quantity === 0) continue;
    out.push({ lineId: line.id, quantity, costCents: Math.round(quantity * line.unitPriceCents), line });
  }
  if (!out.length) return { ok: false, error: 'Nothing to receive' };
  return { ok: true, value: out };
}

/** Ordered but not yet received, in cents: the PO's committed cost for job costing. */
export function committedCents(status: PoStatus, lines: Pick<PoLine, 'quantity' | 'receivedQty' | 'unitPriceCents'>[]): number {
  if (!OPEN_PO_STATUSES.includes(status)) return 0;
  return lines.reduce(
    (sum, line) => sum + Math.round(Math.max(0, line.quantity - line.receivedQty) * line.unitPriceCents),
    0
  );
}
