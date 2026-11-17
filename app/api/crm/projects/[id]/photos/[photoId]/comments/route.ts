import { NextRequest, NextResponse } from 'next/server';
import { requireContractor } from '@/lib/crm/require-contractor';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const postSchema = z.object({
  body: z.string().trim().min(1).max(2000),
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

/** GET /api/crm/projects/[id]/photos/[photoId]/comments */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string; photoId: string }> }) {
  try {
    const { error, supabase, user } = await requireContractor();
    if (error || !user) return error!;
    const { id, photoId } = await context.params;
    if (!(await ownPhoto(supabase, user.id, id, photoId))) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }
    const { data, error: listError } = await supabase
      .from('pro_jobsite_photo_comments')
      .select('id, body, created_at')
      .eq('photo_id', photoId)
      .eq('owner_id', user.id)
      .order('created_at', { ascending: true });
    if (listError) return NextResponse.json({ error: listError.message }, { status: 400 });
    return NextResponse.json({
      comments: (data ?? []).map((row) => ({ id: row.id, body: row.body, createdAt: row.created_at })),
    });
  } catch {
    return NextResponse.json({ error: 'Could not load comments' }, { status: 500 });
  }
}

/** POST /api/crm/projects/[id]/photos/[photoId]/comments */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string; photoId: string }> }) {
  try {
    const { error, supabase, user } = await requireContractor();
    if (error || !user) return error!;
    const { id, photoId } = await context.params;
    const body = postSchema.parse(await request.json());
    if (!(await ownPhoto(supabase, user.id, id, photoId))) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }
    const { data, error: insertError } = await supabase
      .from('pro_jobsite_photo_comments')
      .insert({ photo_id: photoId, owner_id: user.id, body: body.body })
      .select('id, body, created_at')
      .single();
    if (insertError || !data) return NextResponse.json({ error: insertError?.message || 'Could not save the comment' }, { status: 400 });
    return NextResponse.json({ id: data.id, body: data.body, createdAt: data.created_at }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Write a comment first' }, { status: 400 });
    return NextResponse.json({ error: 'Could not save the comment' }, { status: 500 });
  }
}
