import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasRole } from '@/lib/utils/roles';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/projobs/[id]
 * Remove a job. Only the contractor who owns it can delete it.
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'contractor_required' }, { status: 401 });
    }

    const isContractor = await hasRole(user.id, 'contractor');
    if (!isContractor) {
      return NextResponse.json({ error: 'contractor_required' }, { status: 403 });
    }

    const { data: existing, error: readError } = await supabase
      .from('pro_jobs')
      .select('id, owner_id')
      .eq('id', id)
      .maybeSingle();

    if (readError) {
      return NextResponse.json({ error: 'Could not delete job' }, { status: 500 });
    }
    if (!existing || existing.owner_id !== user.id) {
      return NextResponse.json({ error: 'contractor_required' }, { status: 403 });
    }

    const { error } = await supabase.from('pro_jobs').delete().eq('id', id).eq('owner_id', user.id);
    if (error) {
      return NextResponse.json({ error: 'Could not delete job' }, { status: 403 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/projobs/[id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
