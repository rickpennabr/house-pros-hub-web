import { NextRequest, NextResponse } from 'next/server';
import { requireContractor } from '@/lib/crm/require-contractor';

/**
 * PATCH /api/crm/invoices/recurring/[id]  { isActive: boolean }
 * DELETE stops the schedule.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError, user, supabase } = await requireContractor();
    if (authError || !user) return authError;
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    if (typeof body.isActive !== 'boolean') {
      return NextResponse.json({ error: 'isActive is required' }, { status: 400 });
    }
    const { error } = await supabase
      .from('pro_crm_recurring_invoices')
      .update({ is_active: body.isActive })
      .eq('id', id)
      .eq('owner_id', user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/crm/invoices/recurring/[id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error: authError, user, supabase } = await requireContractor();
    if (authError || !user) return authError;
    const { id } = await params;
    const { error } = await supabase
      .from('pro_crm_recurring_invoices')
      .delete()
      .eq('id', id)
      .eq('owner_id', user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/crm/invoices/recurring/[id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
