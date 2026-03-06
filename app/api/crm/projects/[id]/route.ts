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
    if (!id) return NextResponse.json({ error: 'Project ID required' }, { status: 400 });

    const supabase = await createClient();
    const { data: row, error } = await supabase.from('pro_crm_projects').select('*').eq('id', id).eq('owner_id', user.id).single();
    if (error || !row) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const { data: customer } = await supabase.from('pro_crm_customers').select('id, first_name, last_name').eq('id', row.customer_id).single();
    return NextResponse.json({
      id: row.id,
      customerId: row.customer_id,
      customerFirstName: customer?.first_name ?? null,
      customerLastName: customer?.last_name ?? null,
      estimateId: row.estimate_id,
      name: row.name,
      status: row.status,
      startDate: row.start_date,
      endDate: row.end_date,
      note: row.note ?? '',
    });
  } catch (err) {
    console.error('GET /api/crm/projects/[id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError!;
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Project ID required' }, { status: 400 });

    const body = await request.json();
    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = typeof body.name === 'string' ? body.name.trim() : undefined;
    if (body.customerId !== undefined) {
      const supabase = await createClient();
      const { data: c } = await supabase.from('pro_crm_customers').select('id').eq('id', body.customerId).eq('owner_id', user.id).single();
      if (c) updates.customer_id = body.customerId;
    }
    if (body.estimateId !== undefined) updates.estimate_id = body.estimateId || null;
    if (body.status !== undefined && ['planned', 'in_progress', 'on_hold', 'completed', 'cancelled'].includes(body.status)) updates.status = body.status;
    if (body.startDate !== undefined) updates.start_date = body.startDate || null;
    if (body.endDate !== undefined) updates.end_date = body.endDate || null;
    if (body.note !== undefined) updates.note = typeof body.note === 'string' ? body.note.trim() || null : null;

    const supabase = await createClient();
    const { error } = await supabase.from('pro_crm_projects').update(updates).eq('id', id).eq('owner_id', user.id);
    if (error) return NextResponse.json({ error: error.message || 'Failed to update project' }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PUT /api/crm/projects/[id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError!;
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Project ID required' }, { status: 400 });

    const supabase = await createClient();
    const { error } = await supabase.from('pro_crm_projects').delete().eq('id', id).eq('owner_id', user.id);
    if (error) return NextResponse.json({ error: error.message || 'Failed to delete project' }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/crm/projects/[id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
