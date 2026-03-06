import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasRole } from '@/lib/utils/roles';

async function requireContractor() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null };
  }
  const isContractor = await hasRole(user.id, 'contractor');
  if (!isContractor) {
    return { error: NextResponse.json({ error: 'Forbidden - Contractor access required' }, { status: 403 }), user: null };
  }
  return { error: null, user };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError!;

    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Estimate ID required' }, { status: 400 });

    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from('pro_crm_estimates')
      .select('*')
      .eq('id', id)
      .eq('owner_id', user.id)
      .single();

    if (error || !row) return NextResponse.json({ error: 'Estimate not found' }, { status: 404 });

    const { data: customer } = await supabase
      .from('pro_crm_customers')
      .select('id, first_name, last_name')
      .eq('id', row.customer_id)
      .single();

    return NextResponse.json({
      id: row.id,
      customerId: row.customer_id,
      customerFirstName: customer?.first_name ?? null,
      customerLastName: customer?.last_name ?? null,
      amountCents: row.amount_cents,
      lineItems: row.line_items,
      status: row.status,
      dueDate: row.due_date,
      note: row.note ?? '',
    });
  } catch (err) {
    console.error('GET /api/crm/estimates/[id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError!;

    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Estimate ID required' }, { status: 400 });

    const body = await request.json();
    const updates: Record<string, unknown> = {};
    if (body.amountCents !== undefined) updates.amount_cents = typeof body.amountCents === 'number' ? body.amountCents : parseInt(String(body.amountCents), 10) || 0;
    if (body.lineItems !== undefined) updates.line_items = body.lineItems;
    if (body.status !== undefined && ['draft', 'sent', 'accepted', 'declined'].includes(body.status)) updates.status = body.status;
    if (body.dueDate !== undefined) updates.due_date = body.dueDate || null;
    if (body.note !== undefined) updates.note = typeof body.note === 'string' ? body.note.trim() || null : null;
    if (body.customerId !== undefined) {
      const supabase = await createClient();
      const { data: customer } = await supabase
        .from('pro_crm_customers')
        .select('id')
        .eq('id', body.customerId)
        .eq('owner_id', user.id)
        .single();
      if (customer) updates.customer_id = body.customerId;
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from('pro_crm_estimates')
      .update(updates)
      .eq('id', id)
      .eq('owner_id', user.id);

    if (error) return NextResponse.json({ error: error.message || 'Failed to update estimate' }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PUT /api/crm/estimates/[id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError!;

    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Estimate ID required' }, { status: 400 });

    const supabase = await createClient();
    const { error } = await supabase
      .from('pro_crm_estimates')
      .delete()
      .eq('id', id)
      .eq('owner_id', user.id);

    if (error) return NextResponse.json({ error: error.message || 'Failed to delete estimate' }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/crm/estimates/[id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
