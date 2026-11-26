import { NextRequest, NextResponse } from 'next/server';
import { requireCrmScope } from '@/lib/crm/crm-scope';
import { parsePoLine, PO_STATUSES, type PoLineInput } from '@/lib/crm/purchase-orders';
import {
  centsField,
  checkPoLinks,
  dateField,
  loadPoLines,
  loadPoNames,
  nextPoNumber,
  PO_COLUMNS,
  PO_SETUP_ERROR,
  poJson,
  poSchemaMissing,
  textField,
  writePoLines,
  type PoRow,
} from '@/lib/crm/purchase-orders-db';

/**
 * GET /api/crm/purchase-orders?status=&projectId=&supplierId= — the pro's POs, newest first.
 * POST — create a draft { supplierId, projectId, neededBy, deliveryAddress, notes, taxCents, shippingCents, lines[] }.
 * Owners only: crew members cannot order or see prices.
 */
export async function GET(request: NextRequest) {
  try {
    const { error, scope } = await requireCrmScope();
    if (error) return error;
    if (scope.isCrew) return NextResponse.json({ error: 'Owners only' }, { status: 403 });
    const params = new URL(request.url).searchParams;
    let query = scope.supabase.from('pro_crm_purchase_orders').select(PO_COLUMNS).eq('owner_id', scope.ownerId);
    const status = params.get('status');
    if (status && (PO_STATUSES as readonly string[]).includes(status)) query = query.eq('status', status);
    const projectId = params.get('projectId');
    if (projectId) query = query.eq('project_id', projectId);
    const supplierId = params.get('supplierId');
    if (supplierId) query = query.eq('supplier_id', supplierId);
    const { data, error: qErr } = await query.order('order_date', { ascending: false }).order('created_at', { ascending: false }).limit(500);
    if (qErr) {
      if (poSchemaMissing(qErr.message)) return NextResponse.json({ purchaseOrders: [], setupError: PO_SETUP_ERROR });
      return NextResponse.json({ error: qErr.message }, { status: 500 });
    }
    const rows = (data ?? []) as PoRow[];
    const [lines, names] = await Promise.all([
      loadPoLines(scope.supabase, scope.ownerId, rows.map((r) => r.id)),
      loadPoNames(scope.supabase, scope.ownerId, rows),
    ]);
    return NextResponse.json({ purchaseOrders: rows.map((row) => poJson(row, lines.get(row.id) ?? [], names)) });
  } catch (err) {
    console.error('GET /api/crm/purchase-orders', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { error, scope } = await requireCrmScope();
    if (error) return error;
    if (scope.isCrew) return NextResponse.json({ error: 'Owners only' }, { status: 403 });
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const lines: PoLineInput[] = [];
    for (const raw of Array.isArray(body.lines) ? body.lines : []) {
      const parsed = parsePoLine(raw);
      if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
      lines.push(parsed.value);
    }
    const supplierId = textField(body.supplierId, 64);
    const projectId = textField(body.projectId, 64);
    const linkError = await checkPoLinks(scope.supabase, scope.ownerId, supplierId, projectId);
    if (linkError) return linkError;

    const poNumber = await nextPoNumber(scope.supabase, scope.ownerId);
    const { data, error: insErr } = await scope.supabase
      .from('pro_crm_purchase_orders')
      .insert({
        owner_id: scope.ownerId,
        po_number: poNumber,
        supplier_id: supplierId,
        project_id: projectId,
        order_date: dateField(body.orderDate) ?? new Date().toISOString().slice(0, 10),
        needed_by: dateField(body.neededBy),
        delivery_address: textField(body.deliveryAddress, 500),
        notes: textField(body.notes, 2000),
      })
      .select('id')
      .single();
    if (insErr || !data) {
      if (poSchemaMissing(insErr?.message)) return NextResponse.json({ error: PO_SETUP_ERROR }, { status: 400 });
      return NextResponse.json({ error: insErr?.message || 'Failed to create purchase order' }, { status: 500 });
    }
    const id = (data as { id: string }).id;
    const lineErr = await writePoLines(scope.supabase, scope.ownerId, id, lines, centsField(body.taxCents), centsField(body.shippingCents));
    if (lineErr) return NextResponse.json({ error: lineErr }, { status: 500 });
    return NextResponse.json({ id, poNumber }, { status: 201 });
  } catch (err) {
    console.error('POST /api/crm/purchase-orders', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
