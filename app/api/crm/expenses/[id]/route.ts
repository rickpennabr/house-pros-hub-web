import { NextRequest, NextResponse } from 'next/server';
import { requireContractor } from '@/lib/crm/require-contractor';
import { createClient } from '@/lib/supabase/server';
import { categoryNeedsSupplier, cleanExpenseText, parseExpenseOrderFields, resolveOwnedSupplierId, supplierNamesById } from '@/lib/crm/expense-supplier';
import { MILEAGE_SETUP_ERROR, mileageSchemaMissing, resolveVehicleId } from '@/lib/crm/mileage';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError!;
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Expense ID required' }, { status: 400 });

    const supabase = await createClient();
    const { data: row, error } = await supabase.from('pro_crm_expenses').select('*').eq('id', id).eq('owner_id', user.id).single();
    if (error || !row) return NextResponse.json({ error: 'Expense not found' }, { status: 404 });

    const names = row.supplier_id ? await supplierNamesById(supabase, [row.supplier_id]) : new Map<string, string>();

    return NextResponse.json({
      id: row.id,
      projectId: row.project_id,
      maintenancePlanId: (row as { maintenance_plan_id?: string | null }).maintenance_plan_id ?? null,
      amountCents: row.amount_cents,
      category: row.category,
      expenseDate: row.expense_date,
      note: row.note ?? '',
      description: row.description ?? '',
      supplierId: row.supplier_id ?? '',
      supplierName: row.supplier_id ? names.get(row.supplier_id) ?? '' : '',
      poNumber: row.po_number ?? '',
      quantity: row.quantity == null || !Number.isFinite(Number(row.quantity)) ? '' : Number(row.quantity),
      unit: row.unit ?? '',
      requestedBy: row.requested_by ?? '',
      orderedBy: row.ordered_by ?? '',
      receiptUrl: row.receipt_url ?? '',
      vehicleId: row.vehicle_id ?? '',
    });
  } catch (err) {
    console.error('GET /api/crm/expenses/[id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError!;
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Expense ID required' }, { status: 400 });

    const body = await request.json();
    const supabase = await createClient();
    const updates: Record<string, unknown> = {};
    if (body.amountCents !== undefined) updates.amount_cents = typeof body.amountCents === 'number' ? body.amountCents : Math.round(parseFloat(String(body.amountCents)) * 100) || 0;
    if (body.category !== undefined) updates.category = typeof body.category === 'string' ? body.category.trim() || 'other' : 'other';
    if (body.expenseDate !== undefined) updates.expense_date = body.expenseDate;
    if (body.note !== undefined) updates.note = typeof body.note === 'string' ? body.note.trim() || null : null;
    if (body.description !== undefined) updates.description = cleanExpenseText(body.description);
    if (body.receiptUrl !== undefined) updates.receipt_url = typeof body.receiptUrl === 'string' ? body.receiptUrl.trim() || null : null;
    if (body.category !== undefined && !categoryNeedsSupplier(String(updates.category ?? ''))) {
      updates.supplier_id = null;
    }
    if ((body.supplierId !== undefined || body.supplier_id !== undefined) && updates.supplier_id === undefined) {
      const supplier = await resolveOwnedSupplierId(supabase, user.id, body.supplierId ?? body.supplier_id);
      if (supplier.error) return NextResponse.json({ error: supplier.error }, { status: supplier.status });
      updates.supplier_id = supplier.id;
    }
    const orderKeys = ['poNumber', 'po_number', 'quantity', 'unit', 'requestedBy', 'requested_by', 'orderedBy', 'ordered_by'];
    const categoryForOrder = typeof updates.category === 'string' ? updates.category : undefined;
    if (orderKeys.some((key) => body[key] !== undefined) || (categoryForOrder && !categoryNeedsSupplier(categoryForOrder))) {
      Object.assign(updates, parseExpenseOrderFields(categoryForOrder, body));
    }
    if (body.projectId !== undefined) {
      if (body.projectId) {
        const { data: p } = await supabase.from('pro_crm_projects').select('id').eq('id', body.projectId).eq('owner_id', user.id).single();
        if (p) updates.project_id = body.projectId;
      } else updates.project_id = null;
    }
    if (body.maintenancePlanId !== undefined) {
      if (body.maintenancePlanId) {
        const { data: plan } = await supabase.from('pro_crm_maintenance_plans').select('id').eq('id', body.maintenancePlanId).eq('owner_id', user.id).maybeSingle();
        if (plan) {
          updates.maintenance_plan_id = body.maintenancePlanId;
          updates.project_id = null;
        }
      } else updates.maintenance_plan_id = null;
    }
    if (body.vehicleId !== undefined || body.vehicle_id !== undefined || updates.category !== undefined) {
      let category = typeof updates.category === 'string' ? updates.category : '';
      if (!category) {
        const { data: current } = await supabase.from('pro_crm_expenses').select('category').eq('id', id).eq('owner_id', user.id).maybeSingle();
        category = current?.category ?? '';
      }
      const vehicle = await resolveVehicleId(supabase, user.id, category, body.vehicleId ?? body.vehicle_id);
      if (vehicle.error) return NextResponse.json({ error: vehicle.error }, { status: vehicle.status });
      updates.vehicle_id = vehicle.id;
    }

    let { error } = await supabase.from('pro_crm_expenses').update(updates).eq('id', id).eq('owner_id', user.id);
    if (error && mileageSchemaMissing(error.message) && updates.vehicle_id == null) {
      const withoutVehicle = { ...updates };
      delete withoutVehicle.vehicle_id;
      const retry = await supabase.from('pro_crm_expenses').update(withoutVehicle).eq('id', id).eq('owner_id', user.id);
      error = retry.error;
    }
    if (error && mileageSchemaMissing(error.message)) {
      return NextResponse.json({ error: MILEAGE_SETUP_ERROR }, { status: 400 });
    }
    if (error) return NextResponse.json({ error: error.message || 'Failed to update expense' }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PUT /api/crm/expenses/[id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError!;
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Expense ID required' }, { status: 400 });

    const supabase = await createClient();
    const { error } = await supabase.from('pro_crm_expenses').delete().eq('id', id).eq('owner_id', user.id);
    if (error) return NextResponse.json({ error: error.message || 'Failed to delete expense' }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/crm/expenses/[id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
