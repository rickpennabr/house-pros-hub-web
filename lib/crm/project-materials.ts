/** Project materials for any trade: planned quantity, deliveries, and what is still to send. */

export const MATERIAL_UNITS = ['Pallet', 'Ton', 'Bag', 'pcs', 'LF', 'sq ft', 'cu yd', 'Each', 'Gal', 'Roll', 'Box', 'Load'] as const;

export interface MaterialWrite {
  name: string;
  unit: string;
  plannedQty: number;
  note: string | null;
}

export interface DeliveryWrite {
  quantity: number;
  deliveredOn: string;
  source: string | null;
  note: string | null;
}

export interface MaterialSummary {
  plannedQty: number;
  deliveredQty: number;
  /** Planned minus delivered, never below 0. */
  remainingQty: number;
  /** Delivered beyond the plan. */
  extraQty: number;
  status: 'not_sent' | 'partial' | 'sent' | 'over';
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const round2 = (value: number) => Math.round(value * 100) / 100;

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  return trimmed ? trimmed.slice(0, max) : null;
}

/** Accepts 3, "3", "1.5", "1,5". */
export function parseQuantity(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? round2(value) : null;
  if (typeof value !== 'string') return null;
  const cleaned = value.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  return round2(Number(cleaned));
}

export function parseMaterialWrite(body: unknown, partial = false): Result<Partial<MaterialWrite>> {
  const input = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const out: Partial<MaterialWrite> = {};
  if (!partial || 'name' in input) {
    const name = text(input.name, 200);
    if (!name) return { ok: false, error: 'Enter the material name' };
    out.name = name;
  }
  if (!partial || 'unit' in input) out.unit = text(input.unit, 40) ?? 'Each';
  if (!partial || 'plannedQty' in input) {
    const qty = parseQuantity(input.plannedQty ?? 0);
    if (qty == null || qty < 0 || qty > 1_000_000) return { ok: false, error: 'Enter the planned quantity as a number' };
    out.plannedQty = qty;
  }
  if (!partial || 'note' in input) out.note = text(input.note, 500);
  return { ok: true, value: out };
}

export function parseDeliveryWrite(body: unknown, today: string): Result<DeliveryWrite> {
  const input = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const quantity = parseQuantity(input.quantity);
  if (quantity == null || quantity <= 0 || quantity > 1_000_000) return { ok: false, error: 'Enter how much was sent' };
  const date = typeof input.deliveredOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.deliveredOn) ? input.deliveredOn : today;
  return { ok: true, value: { quantity, deliveredOn: date, source: text(input.source, 120), note: text(input.note, 500) } };
}

export function summarizeMaterial(plannedQty: number, deliveries: Array<{ quantity: number | string }>): MaterialSummary {
  const planned = round2(Number(plannedQty) || 0);
  const delivered = round2(deliveries.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0));
  const remaining = round2(Math.max(0, planned - delivered));
  const extra = round2(Math.max(0, delivered - planned));
  const status: MaterialSummary['status'] =
    delivered <= 0 ? 'not_sent' : extra > 0 ? 'over' : remaining > 0 ? 'partial' : 'sent';
  return { plannedQty: planned, deliveredQty: delivered, remainingQty: remaining, extraQty: extra, status };
}

/** "1.5" not "1.50", "12" not "12.00". */
export function formatQty(value: number): string {
  return String(round2(value));
}
