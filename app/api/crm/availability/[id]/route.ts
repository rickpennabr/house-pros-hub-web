import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requirePro } from '@/lib/crm/require-pro';

async function requireCalendarPro() {
  const result = await requirePro();
  return { error: result.error, user: result.user };
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error: authError, user } = await requireCalendarPro();
    if (authError || !user) return authError!;
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const body = await request.json();
    const updates: Record<string, unknown> = {};
    if (body.type !== undefined && ['available', 'unavailable', 'appointment'].includes(body.type)) updates.type = body.type;
    if (body.startAt !== undefined) updates.start_at = new Date(body.startAt).toISOString();
    if (body.endAt !== undefined) updates.end_at = new Date(body.endAt).toISOString();
    if (body.note !== undefined) updates.note = typeof body.note === 'string' ? body.note.trim() || null : null;

    const supabase = await createClient();
    const { error } = await supabase
      .from('pro_crm_availability')
      .update(updates)
      .eq('id', id)
      .eq('owner_id', user.id);

    if (error) return NextResponse.json({ error: error.message || 'Failed to update' }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PUT /api/crm/availability/[id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error: authError, user } = await requireCalendarPro();
    if (authError || !user) return authError!;
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const supabase = await createClient();
    const { error } = await supabase.from('pro_crm_availability').delete().eq('id', id).eq('owner_id', user.id);
    if (error) return NextResponse.json({ error: error.message || 'Failed to delete' }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/crm/availability/[id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
