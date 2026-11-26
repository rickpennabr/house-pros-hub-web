import { NextRequest, NextResponse } from 'next/server';
import { requireCrmScope } from '@/lib/crm/crm-scope';
import { canEditLines, parsePoLine, type PoLineInput, type PoStatus } from '@/lib/crm/purchase-orders';
import {
  centsField,
  checkPoLinks,
  dateField,
  loadPoLines,
  loadPoNames,
  PO_COLUMNS,
  poJson,
  textField,
  writePoLines,
  type PoRow,
} from '@/lib/crm/purchase-orders-db';

type Params = { params: Promise<{ id: string }> };

async function loadPo(scope: { supabase: import('@/lib/crm/crm-scope').CrmDb; ownerId: string }, id: string) {
  const { data } = await scope.supabase.from('pro_crm_purchase_orders').select(PO_COLUMNS).eq('owner_id', scope.ownerId).eq('id', id).maybeSingle();
  return (data as PoRow | null) ?? null;
}

/** GET one PO with lines. PATCH fields, lines (before anything is received) or status (closed / cancelled). DELETE drafts. */
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { error, scope } = await requireCrmScope();
    if (error) return error;
    if (scope.isCrew) return NextResponse.json({ error: 'Owners only' }, { status: 403 });
    const row = await loadPo(scope, (await params).id);
    if (!row) return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    const [lines, names] = await Promise.all([
      loadPoLines(scope.supabase, scope.ownerId, [row.id]),
      loadPoNames(scope.supabase, scope.ownerId, [row]),
    ]);
    return NextResponse.json({ purchaseOrder: poJson(row, lines.get(row.id) ?? [], names) });
  } catch (err) {
    console.error('GET /api/crm/purchase-orders/[id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { error, scope } = await requireCrmScope();
    if (error) return error;
    if (scope.isCrew) return NextResponse.json({ error: 'Owners only' }, { status: 403 });
    const row = await loadPo(scope, (await params).id);
    if (!row) return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if ('supplierId' in body || 'projectId' in body) {
      const supplierId = 'supplierId' in body ? textField(body.supplierId, 64) : row.supplier_id;
      const projectId = 'projectId' in body ? textField(body.projectId, 64) : row.project_id;
      const linkError = await checkPoLinks(scope.supabase, scope.ownerId, supplierId, projectId);
      if (linkError) return linkError;
      update.supplier_id = supplierId;
      update.project_id = projectId;
    }
    if ('orderDate' in body && dateField(body.orderDate)) update.order_date = dateField(body.orderDate);
    if ('neededBy' in body) update.needed_by = dateField(body.neededBy);
    if ('deliveryAddress' in body) update.delivery_address = textField(body.deliveryAddress, 500);
    if ('notes' in body) update.notes = textField(body.notes, 2000);

    if ('status' in body) {
      const next = body.status as PoStatus;
      const allowed: Partial<Record<PoStatus, PoStatus[]>> = {
        draft: ['cancelled', 'sent'],
        sent: ['confirmed', 'cancelled', 'draft'],
        confirmed: ['cancelled'],
        partial: ['closed'],
        received: ['closed'],
        cancelled: ['draft'],
      };
      if (!(allowed[row.status] ?? []).includes(next)) {
        return NextResponse.json({ error: `Cannot change a ${row.status} purchase order to ${String(next)}` }, { status: 400 });
      }
      update.status = next;
      if (next === 'confirmed') update.confirmed_at = new Date().toISOString();
    }

    const { error: updErr } = await scope.supabase.from('pro_crm_purchase_orders').update(update).eq('owner_id', scope.ownerId).eq('id', row.id);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    if ('lines' in body || 'taxCents' in body || 'shippingCents' in body) {
      if (!canEditLines(row.status)) return NextResponse.json({ error: 'Items cannot change after goods are received' }, { status: 400 });
      let lines: PoLineInput[];
      if ('lines' in body) {
        lines = [];
        for (const raw of Array.isArray(body.lines) ? body.lines : []) {
          const parsed = parsePoLine(raw);
          if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
          lines.push(parsed.value);
        }
      } else {
        lines = (await loadPoLines(scope.supabase, scope.ownerId, [row.id])).get(row.id) ?? [];
      }
      const tax = 'taxCents' in body ? centsField(body.taxCents) : Number(row.tax_cents);
      const shipping = 'shippingCents' in body ? centsField(body.shippingCents) : Number(row.shipping_cents);
      const lineErr = await writePoLines(scope.supabase, scope.ownerId, row.id, lines, tax, shipping);
      if (lineErr) return NextResponse.json({ error: lineErr }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/crm/purchase-orders/[id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { error, scope } = await requireCrmScope();
    if (error) return error;
    if (scope.isCrew) return NextResponse.json({ error: 'Owners only' }, { status: 403 });
    const row = await loadPo(scope, (await params).id);
    if (!row) return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    if (row.status !== 'draft' && row.status !== 'cancelled') {
      return NextResponse.json({ error: 'Only draft or cancelled purchase orders can be deleted' }, { status: 400 });
    }
    const { error: delErr } = await scope.supabase.from('pro_crm_purchase_orders').delete().eq('owner_id', scope.ownerId).eq('id', row.id);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/crm/purchase-orders/[id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
