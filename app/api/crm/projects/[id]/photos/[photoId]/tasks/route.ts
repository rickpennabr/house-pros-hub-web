import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { hasRole } from '@/lib/utils/roles';

async function requireContractor() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), supabase, user: null };
  const isContractor = await hasRole(user.id, 'contractor');
  if (!isContractor) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), supabase, user: null };
  return { error: null, supabase, user };
}

const postSchema = z.object({
  title: z.string().trim().min(1).max(200),
  assigneeId: z.string().uuid().nullable().optional(),
});

async function ownPhoto(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  projectId: string,
  photoId: string
) {
  const { data } = await supabase
    .from('pro_jobsite_photos')
    .select('id')
    .eq('id', photoId)
    .eq('project_id', projectId)
    .eq('owner_id', userId)
    .maybeSingle();
  return Boolean(data);
}

/** GET /api/crm/projects/[id]/photos/[photoId]/tasks */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string; photoId: string }> }) {
  try {
    const { error, supabase, user } = await requireContractor();
    if (error || !user) return error!;
    const { id, photoId } = await context.params;
    if (!(await ownPhoto(supabase, user.id, id, photoId))) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }
    const { data, error: listError } = await supabase
      .from('pro_jobsite_photo_tasks')
      .select('id, title, done, assignee_contact_id, created_at')
      .eq('photo_id', photoId)
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false });
    if (listError) return NextResponse.json({ error: listError.message }, { status: 400 });
    const assigneeIds = [...new Set((data ?? []).map((row) => row.assignee_contact_id).filter((value): value is string => Boolean(value)))];
    const { data: contacts } = assigneeIds.length
      ? await supabase.from('pro_crm_customers').select('id, display_name, first_name, last_name').in('id', assigneeIds)
      : { data: [] };
    const names = new Map((contacts ?? []).map((row) => [
      row.id,
      row.display_name?.trim() || [row.first_name, row.last_name].filter(Boolean).join(' ') || '',
    ]));
    return NextResponse.json({
      tasks: (data ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        done: row.done,
        assigneeId: row.assignee_contact_id,
        assigneeName: row.assignee_contact_id ? names.get(row.assignee_contact_id) ?? '' : null,
        createdAt: row.created_at,
      })),
    });
  } catch {
    return NextResponse.json({ error: 'Could not load tasks' }, { status: 500 });
  }
}

/** POST /api/crm/projects/[id]/photos/[photoId]/tasks */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string; photoId: string }> }) {
  try {
    const { error, supabase, user } = await requireContractor();
    if (error || !user) return error!;
    const { id, photoId } = await context.params;
    const body = postSchema.parse(await request.json());
    if (!(await ownPhoto(supabase, user.id, id, photoId))) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }
    if (body.assigneeId) {
      const { data: contact } = await supabase.from('pro_crm_customers').select('id').eq('id', body.assigneeId).eq('owner_id', user.id).maybeSingle();
      if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }
    const { data, error: insertError } = await supabase
      .from('pro_jobsite_photo_tasks')
      .insert({
        photo_id: photoId,
        owner_id: user.id,
        title: body.title,
        assignee_contact_id: body.assigneeId ?? null,
      })
      .select('id')
      .single();
    if (insertError || !data) return NextResponse.json({ error: insertError?.message || 'Could not save the task' }, { status: 400 });
    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Give the task a name' }, { status: 400 });
    return NextResponse.json({ error: 'Could not save the task' }, { status: 500 });
  }
}
