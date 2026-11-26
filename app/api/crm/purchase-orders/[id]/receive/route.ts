import { NextRequest, NextResponse } from 'next/server';
import { requireCrmScope } from '@/lib/crm/crm-scope';
import { canReceive, planReceipt, statusAfterReceiving, type PoLine } from '@/lib/crm/purchase-orders';
import { dateField, loadPoLines, PO_COLUMNS, type PoRow } from '@/lib/crm/purchase-orders-db';

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/crm/purchase-orders/[id]/receive { receivedOn, lines: [{ lineId, quantity }] }
 * Adds to each line's received quantity, logs project material deliveries for linked materials,
 * and records one Materials expense for what arrived (linked to the PO, supplier and project).
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { error, scope } = await requireCrmScope();
    if (error) return error;
    if (scope.isCrew) return NextResponse.json({ error: 'Owners only' }, { status: 403 });
    const db = scope.supabase;
    const { data } = await db.from('pro_crm_purchase_orders').select(PO_COLUMNS).eq('owner_id', scope.ownerId).eq('id', (await params).id).maybeSingle();
    const po = data as PoRow | null;
    if (!po) return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    if (!canReceive(po.status)) return NextResponse.json({ error: 'Send the purchase order before receiving goods' }, { status: 400 });

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const receivedOn = dateField(body.receivedOn) ?? new Date().toISOString().slice(0, 10);
    const lines = (await loadPoLines(db, scope.ownerId, [po.id])).get(po.id) ?? [];
    const plan = planReceipt(lines, Array.isArray(body.lines) ? (body.lines as { lineId: string; quantity: number }[]) : []);
    if (!plan.ok) return NextResponse.json({ error: plan.error }, { status: 400 });

    const updated: PoLine[] = lines.map((line) => ({ ...line }));
    for (const item of plan.value) {
      const line = updated.find((l) => l.id === item.lineId)!;
      line.receivedQty = Math.round((line.receivedQty + item.quantity) * 100) / 100;
      const { error: lineErr } = await db
        .from('pro_crm_purchase_order_lines')
        .update({ received_qty: line.receivedQty })
        .eq('owner_id', scope.ownerId)
        .eq('id', line.id);
      if (lineErr) return NextResponse.json({ error: lineErr.message }, { status: 500 });
      if (line.materialId && po.project_id) {
        await db.from('pro_crm_project_material_deliveries').insert({
          owner_id: scope.ownerId,
          project_id: po.project_id,
          material_id: line.materialId,
          delivered_on: receivedOn,
          quantity: item.quantity,
          source: po.po_number,
          created_by: scope.user.id,
        });
      }
    }

    // One expense for the delivery, so job costs and markup billing see it.
    const amountCents = plan.value.reduce((sum, item) => sum + item.costCents, 0);
    if (amountCents > 0) {
      const description = plan.value.map((item) => `${item.quantity} ${item.line.unit} ${item.line.description}`).join(', ').slice(0, 500);
      const { error: expErr } = await db.from('pro_crm_expenses').insert({
        owner_id: scope.ownerId,
        project_id: po.project_id,
        supplier_id: po.supplier_id,
        purchase_order_id: po.id,
        po_number: po.po_number,
        category: 'Materials',
        amount_cents: amountCents,
        expense_date: receivedOn,
        description,
        note: `Received on ${po.po_number}`,
      });
      if (expErr) return NextResponse.json({ error: expErr.message }, { status: 500 });
    }

    const status = statusAfterReceiving(updated);
    await db.from('pro_crm_purchase_orders').update({ status, updated_at: new Date().toISOString() }).eq('owner_id', scope.ownerId).eq('id', po.id);
    return NextResponse.json({ ok: true, status, expenseCents: amountCents });
  } catch (err) {
    console.error('POST /api/crm/purchase-orders/[id]/receive', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
