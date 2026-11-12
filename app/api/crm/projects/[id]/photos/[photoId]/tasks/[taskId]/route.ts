import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { hasRole } from '@/lib/utils/roles';

const patchSchema = z.object({
  done: z.boolean().optional(),
  title: z.string().trim().min(1).max(200).optional(),
  assigneeId: z.string().uuid().nullable().optional(),
});

/** PATCH /api/crm/projects/[id]/photos/[photoId]/tasks/[taskId] */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string; photoId: string; taskId: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await hasRole(user.id, 'contractor'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id, photoId, taskId } = await context.params;
    const body = patchSchema.parse(await request.json());
    const { data: photo } = await supabase.from('pro_jobsite_photos').select('id').eq('id', photoId).eq('project_id', id).eq('owner_id', user.id).maybeSingle();
    if (!photo) return NextResponse.json({ error: 'Photo not found' }, { status: 404 });

    const update: { done?: boolean; title?: string; assignee_contact_id?: string | null } = {};
    if (body.done !== undefined) update.done = body.done;
    if (body.title !== undefined) update.title = body.title;
    if (body.assigneeId !== undefined) update.assignee_contact_id = body.assigneeId;
    const { error: updateError } = await supabase
      .from('pro_jobsite_photo_tasks')
      .update(update)
      .eq('id', taskId)
      .eq('photo_id', photoId)
      .eq('owner_id', user.id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });
    return NextResponse.json({ id: taskId });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid task' }, { status: 400 });
    return NextResponse.json({ error: 'Could not update the task' }, { status: 500 });
  }
}
