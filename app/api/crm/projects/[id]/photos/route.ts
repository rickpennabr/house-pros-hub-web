import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { hasRole } from '@/lib/utils/roles';
import { PRO_DRIVE_BUCKET, PRO_DRIVE_SIGNED_URL_SECONDS } from '@/lib/drive/constants';

async function requireContractor() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), supabase, user: null };
  const isContractor = await hasRole(user.id, 'contractor');
  if (!isContractor) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), supabase, user: null };
  return { error: null, supabase, user };
}

const postSchema = z.object({
  driveFileId: z.string().uuid(),
  caption: z.string().trim().max(500).optional(),
  takenAt: z.string().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  accuracyM: z.number().nonnegative().nullable().optional(),
});

/** GET /api/crm/projects/[id]/photos — job timeline with signed image URLs. */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { error, supabase, user } = await requireContractor();
    if (error || !user) return error!;
    const { id } = await context.params;
    const { data: project } = await supabase
      .from('pro_crm_projects')
      .select('id, name, display_id')
      .eq('id', id)
      .eq('owner_id', user.id)
      .maybeSingle();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const { data: business } = await supabase.from('businesses').select('id').eq('owner_id', user.id).limit(1).maybeSingle();
    const { data: rows } = await supabase
      .from('pro_jobsite_photos')
      .select('id, caption, taken_at, latitude, longitude, accuracy_m, drive_file_id')
      .eq('project_id', id)
      .eq('owner_id', user.id)
      .order('taken_at', { ascending: false });

    const fileIds = (rows ?? []).map((row) => row.drive_file_id);
    const { data: files } = fileIds.length
      ? await supabase.from('pro_drive_files').select('id, name, storage_path').in('id', fileIds)
      : { data: [] };
    const fileMap = new Map((files ?? []).map((file) => [file.id, file]));

    const photos = [];
    for (const row of rows ?? []) {
      const file = fileMap.get(row.drive_file_id);
      let url: string | null = null;
      if (file?.storage_path) {
        const signed = await supabase.storage.from(PRO_DRIVE_BUCKET).createSignedUrl(file.storage_path, PRO_DRIVE_SIGNED_URL_SECONDS);
        url = signed.data?.signedUrl ?? null;
      }
      photos.push({
        id: row.id,
        caption: row.caption,
        takenAt: row.taken_at,
        latitude: row.latitude,
        longitude: row.longitude,
        accuracyM: row.accuracy_m,
        driveFileId: row.drive_file_id,
        name: file?.name ?? '',
        url,
      });
    }

    return NextResponse.json({
      project: { id: project.id, name: project.name, displayId: project.display_id },
      businessId: business?.id ?? null,
      photos,
    });
  } catch {
    return NextResponse.json({ error: 'Could not load photos' }, { status: 500 });
  }
}

/** POST /api/crm/projects/[id]/photos — link a ProDrive file to the job. */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { error, supabase, user } = await requireContractor();
    if (error || !user) return error!;
    const { id } = await context.params;
    const body = postSchema.parse(await request.json());
    const { data: project } = await supabase.from('pro_crm_projects').select('id').eq('id', id).eq('owner_id', user.id).maybeSingle();
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    const { data: file } = await supabase.from('pro_drive_files').select('id').eq('id', body.driveFileId).maybeSingle();
    if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 });

    const { data, error: insertError } = await supabase
      .from('pro_jobsite_photos')
      .insert({
        project_id: id,
        owner_id: user.id,
        drive_file_id: body.driveFileId,
        caption: body.caption || null,
        taken_at: body.takenAt ?? new Date().toISOString(),
        latitude: body.latitude ?? null,
        longitude: body.longitude ?? null,
        accuracy_m: body.accuracyM ?? null,
      })
      .select('id')
      .single();
    if (insertError || !data) return NextResponse.json({ error: insertError?.message || 'Could not save the photo' }, { status: 400 });
    return NextResponse.json({ id: data.id });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid photo' }, { status: 400 });
    return NextResponse.json({ error: 'Could not save the photo' }, { status: 500 });
  }
}
