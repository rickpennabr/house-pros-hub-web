import { NextResponse } from 'next/server';
import type { CrmDb } from '@/lib/crm/crm-scope';
import { contactDisplayName } from '@/lib/crm/contact-name';
import { committedCents, formatPoNumber, poTotals, type PoLine, type PoLineInput, type PoStatus } from '@/lib/crm/purchase-orders';

export const PO_SETUP_ERROR = 'Purchase orders need migration 173_purchase_orders.sql. Run it in the Supabase SQL Editor.';

export function poSchemaMissing(message: string | undefined | null): boolean {
  return Boolean(message && /pro_crm_purchase_order|purchase_order_id|po_prefix|next_po_number/.test(message));
}

export interface PoRow {
  id: string;
  po_number: string;
  supplier_id: string | null;
  project_id: string | null;
  status: PoStatus;
  order_date: string;
  needed_by: string | null;
  delivery_address: string | null;
  notes: string | null;
  tax_cents: number;
  shipping_cents: number;
  subtotal_cents: number;
  total_cents: number;
  share_token: string | null;
  sent_at: string | null;
  confirmed_at: string | null;
  created_at: string;
}

interface LineRow {
  id: string;
  purchase_order_id: string;
  material_id: string | null;
  description: string;
  quantity: number | string;
  unit: string;
  unit_price_cents: number;
  received_qty: number | string;
  sort_order: number;
}

export const PO_COLUMNS =
  'id, po_number, supplier_id, project_id, status, order_date, needed_by, delivery_address, notes, tax_cents, shipping_cents, subtotal_cents, total_cents, share_token, sent_at, confirmed_at, created_at';
const LINE_COLUMNS = 'id, purchase_order_id, material_id, description, quantity, unit, unit_price_cents, received_qty, sort_order';

export function toLine(row: LineRow): PoLine {
  return {
    id: row.id,
    description: row.description,
    quantity: Number(row.quantity),
    unit: row.unit,
    unitPriceCents: Number(row.unit_price_cents),
    materialId: row.material_id,
    receivedQty: Number(row.received_qty),
  };
}

export async function loadPoLines(db: CrmDb, ownerId: string, poIds: string[]): Promise<Map<string, PoLine[]>> {
  const out = new Map<string, PoLine[]>();
  if (!poIds.length) return out;
  const { data, error } = await db
    .from('pro_crm_purchase_order_lines')
    .select(LINE_COLUMNS)
    .eq('owner_id', ownerId)
    .in('purchase_order_id', poIds)
    .order('sort_order');
  if (error) throw new Error(error.message);
  for (const row of (data ?? []) as LineRow[]) {
    const list = out.get(row.purchase_order_id) ?? [];
    list.push(toLine(row));
    out.set(row.purchase_order_id, list);
  }
  return out;
}

/** Supplier and project names for a set of POs. */
export async function loadPoNames(db: CrmDb, ownerId: string, rows: PoRow[]) {
  const supplierIds = [...new Set(rows.map((r) => r.supplier_id).filter(Boolean))] as string[];
  const projectIds = [...new Set(rows.map((r) => r.project_id).filter(Boolean))] as string[];
  const [suppliers, projects] = await Promise.all([
    supplierIds.length
      ? db.from('pro_crm_customers').select('id, display_name, company_name, first_name, last_name, email').eq('owner_id', ownerId).in('id', supplierIds)
      : Promise.resolve({ data: [] }),
    projectIds.length
      ? db.from('pro_crm_projects').select('id, name').eq('owner_id', ownerId).in('id', projectIds)
      : Promise.resolve({ data: [] }),
  ]);
  const supplier = new Map<string, { name: string; email: string | null }>();
  for (const s of (suppliers.data ?? []) as { id: string; email: string | null }[]) {
    supplier.set(s.id, { name: contactDisplayName(s as never), email: s.email });
  }
  const project = new Map<string, string>();
  for (const p of (projects.data ?? []) as { id: string; name: string }[]) project.set(p.id, p.name);
  return { supplier, project };
}

export function poJson(
  row: PoRow,
  lines: PoLine[],
  names: { supplier: Map<string, { name: string; email: string | null }>; project: Map<string, string> }
) {
  const supplier = row.supplier_id ? names.supplier.get(row.supplier_id) : undefined;
  return {
    id: row.id,
    poNumber: row.po_number,
    status: row.status,
    supplierId: row.supplier_id,
    supplierName: supplier?.name ?? null,
    supplierEmail: supplier?.email ?? null,
    projectId: row.project_id,
    projectName: row.project_id ? names.project.get(row.project_id) ?? null : null,
    orderDate: row.order_date,
    neededBy: row.needed_by,
    deliveryAddress: row.delivery_address,
    notes: row.notes,
    taxCents: Number(row.tax_cents),
    shippingCents: Number(row.shipping_cents),
    subtotalCents: Number(row.subtotal_cents),
    totalCents: Number(row.total_cents),
    committedCents: committedCents(row.status, lines),
    sentAt: row.sent_at,
    confirmedAt: row.confirmed_at,
    createdAt: row.created_at,
    lines,
  };
}

/** Allocate the next PO number and advance the pro's sequence. */
export async function nextPoNumber(db: CrmDb, ownerId: string): Promise<string> {
  const { data } = await db.from('pro_invoice_settings').select('po_prefix, next_po_number').eq('owner_id', ownerId).maybeSingle();
  const settings = data as { po_prefix: string | null; next_po_number: number | null } | null;
  const next = settings?.next_po_number ?? 1;
  if (settings) {
    await db.from('pro_invoice_settings').update({ next_po_number: next + 1 }).eq('owner_id', ownerId);
  } else {
    await db.from('pro_invoice_settings').insert({ owner_id: ownerId, theme_color_hex: '#000000', next_po_number: next + 1 });
  }
  return formatPoNumber(settings?.po_prefix, next);
}

/** Replace a PO's lines and store fresh totals. */
export async function writePoLines(
  db: CrmDb,
  ownerId: string,
  poId: string,
  lines: PoLineInput[],
  taxCents: number,
  shippingCents: number
): Promise<string | null> {
  const del = await db.from('pro_crm_purchase_order_lines').delete().eq('owner_id', ownerId).eq('purchase_order_id', poId);
  if (del.error) return del.error.message;
  if (lines.length) {
    const ins = await db.from('pro_crm_purchase_order_lines').insert(
      lines.map((line, index) => ({
        owner_id: ownerId,
        purchase_order_id: poId,
        material_id: line.materialId,
        description: line.description,
        quantity: line.quantity,
        unit: line.unit,
        unit_price_cents: line.unitPriceCents,
        sort_order: index,
      }))
    );
    if (ins.error) return ins.error.message;
  }
  const totals = poTotals(lines, taxCents, shippingCents);
  const upd = await db
    .from('pro_crm_purchase_orders')
    .update({ subtotal_cents: totals.subtotalCents, total_cents: totals.totalCents, tax_cents: taxCents, shipping_cents: shippingCents, updated_at: new Date().toISOString() })
    .eq('owner_id', ownerId)
    .eq('id', poId);
  return upd.error?.message ?? null;
}

/** Checks a supplier and project belong to the pro. Returns an error response or null. */
export async function checkPoLinks(db: CrmDb, ownerId: string, supplierId: string | null, projectId: string | null) {
  if (supplierId) {
    const { data } = await db.from('pro_crm_customers').select('id').eq('owner_id', ownerId).eq('id', supplierId).maybeSingle();
    if (!data) return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
  }
  if (projectId) {
    const { data } = await db.from('pro_crm_projects').select('id').eq('owner_id', ownerId).eq('id', projectId).maybeSingle();
    if (!data) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }
  return null;
}

export function centsField(value: unknown): number {
  const n = Math.round(Number(value ?? 0));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function dateField(value: unknown): string | null {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

export function textField(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;
}
