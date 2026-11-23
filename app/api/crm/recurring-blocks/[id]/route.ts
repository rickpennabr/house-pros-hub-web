import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { requirePro } from '@/lib/crm/require-pro';

/** DELETE /api/crm/recurring-blocks/[id]: stop a repeating busy time. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { error: authError, user } = await requirePro();
    if (authError || !user) return authError!;
    const { id } = await params;
    const supabase = (await createClient()) as unknown as SupabaseClient;
    const { error } = await supabase.from('pro_recurring_blocks').delete().eq('id', id).eq('owner_id', user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/crm/recurring-blocks/[id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
