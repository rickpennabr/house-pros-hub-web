import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasRole } from '@/lib/utils/roles';

async function requireContractor() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null };
  const isContractor = await hasRole(user.id, 'contractor');
  if (!isContractor) return { error: NextResponse.json({ error: 'Forbidden - Contractor access required' }, { status: 403 }), user: null };
  return { error: null, user };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError!;
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Expense ID required' }, { status: 400 });

    const supabase = await createClient();
    const { data: row, error } = await supabase.from('pro_crm_expenses').select('*').eq('id', id).eq('owner_id', user.id).single();
    if (error || !row) return NextResponse.json({ error: 'Expense not found' }, { status: 404 });

    return NextResponse.json({
      id: row.id,
      projectId: row.project_id,
      amountCents: row.amount_cents,
      category: row.category,
      expenseDate: row.expense_date,
      note: row.note ?? '',
      receiptUrl: row.receipt_url ?? '',
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
    const updates: Record<string, unknown> = {};
    if (body.amountCents !== undefined) updates.amount_cents = typeof body.amountCents === 'number' ? body.amountCents : Math.round(parseFloat(String(body.amountCents)) * 100) || 0;
    if (body.category !== undefined) updates.category = typeof body.category === 'string' ? body.category.trim() || 'other' : 'other';
    if (body.expenseDate !== undefined) updates.expense_date = body.expenseDate;
    if (body.note !== undefined) updates.note = typeof body.note === 'string' ? body.note.trim() || null : null;
    if (body.receiptUrl !== undefined) updates.receipt_url = typeof body.receiptUrl === 'string' ? body.receiptUrl.trim() || null : null;
    if (body.projectId !== undefined) {
      const supabase = await createClient();
      if (body.projectId) {
        const { data: p } = await supabase.from('pro_crm_projects').select('id').eq('id', body.projectId).eq('owner_id', user.id).single();
        if (p) updates.project_id = body.projectId;
      } else updates.project_id = null;
    }

    const supabase = await createClient();
    const { error } = await supabase.from('pro_crm_expenses').update(updates).eq('id', id).eq('owner_id', user.id);
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
