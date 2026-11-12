import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasRole } from '@/lib/utils/roles';

/** DELETE /api/crm/projects/[id]/members/[contactId] — remove someone from this job. */
export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string; contactId: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await hasRole(user.id, 'contractor'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id, contactId } = await context.params;
    const { data: project } = await supabase.from('pro_crm_projects').select('id').eq('id', id).eq('owner_id', user.id).maybeSingle();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const { error: deleteError } = await supabase
      .from('pro_crm_project_members')
      .delete()
      .eq('project_id', id)
      .eq('contact_id', contactId);
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 });
    return NextResponse.json({ contactId });
  } catch {
    return NextResponse.json({ error: 'Could not remove that person' }, { status: 500 });
  }
}
