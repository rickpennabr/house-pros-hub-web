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

const patchSchema = z.object({
  caption: z.string().trim().max(500).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
  hidden: z.boolean().optional(),
  isCover: z.boolean().optional(),
  trash: z.boolean().optional(),
  pairedPhotoId: z.string().uuid().nullable().optional(),
  duplicate: z.boolean().optional(),
  moveToProjectId: z.string().uuid().optional(),
  driveFileId: z.string().uuid().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  accuracyM: z.number().nonnegative().nullable().optional(),
  headingDeg: z.number().min(0).max(359.999).nullable().optional(),
});

/** PATCH /api/crm/projects/[id]/photos/[photoId] — caption, tags, cover, hide, trash, pair, copy, or move. */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string; photoId: string }> }) {
  try {
    const { error, supabase, user } = await requireContractor();
    if (error || !user) return error!;
    const { id, photoId } = await context.params;
    const body = patchSchema.parse(await request.json());
    const { data: photo } = await supabase
      .from('pro_jobsite_photos')
      .select('id, project_id, drive_file_id, caption, taken_at, latitude, longitude, accuracy_m, tags')
      .eq('id', photoId)
      .eq('project_id', id)
      .eq('owner_id', user.id)
      .maybeSingle();
    if (!photo) return NextResponse.json({ error: 'Photo not found' }, { status: 404 });

    if (body.duplicate) {
      const { data: copy, error: copyError } = await supabase
        .from('pro_jobsite_photos')
        .insert({
          project_id: photo.project_id,
          owner_id: user.id,
          drive_file_id: photo.drive_file_id,
          caption: photo.caption,
          taken_at: photo.taken_at,
          latitude: photo.latitude,
          longitude: photo.longitude,
          accuracy_m: photo.accuracy_m,
          tags: photo.tags ?? [],
        })
        .select('id')
        .single();
      if (copyError || !copy) return NextResponse.json({ error: copyError?.message || 'Could not duplicate the photo' }, { status: 400 });
      return NextResponse.json({ id: copy.id });
    }

    if (body.moveToProjectId) {
      const { data: target } = await supabase
        .from('pro_crm_projects')
        .select('id')
        .eq('id', body.moveToProjectId)
        .eq('owner_id', user.id)
        .maybeSingle();
      if (!target) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      const { error: moveError } = await supabase
        .from('pro_jobsite_photos')
        .update({ project_id: body.moveToProjectId, is_cover: false, paired_photo_id: null })
        .eq('id', photoId)
        .eq('owner_id', user.id);
      if (moveError) return NextResponse.json({ error: moveError.message }, { status: 400 });
      return NextResponse.json({ id: photoId, projectId: body.moveToProjectId });
    }

    if (body.pairedPhotoId) {
      const { data: before } = await supabase
        .from('pro_jobsite_photos')
        .select('id')
        .eq('id', body.pairedPhotoId)
        .eq('project_id', id)
        .eq('owner_id', user.id)
        .maybeSingle();
      if (!before || before.id === photoId) return NextResponse.json({ error: 'Choose another photo on this job' }, { status: 400 });
    }

    if (body.isCover) {
      await supabase
        .from('pro_jobsite_photos')
        .update({ is_cover: false })
        .eq('project_id', id)
        .eq('owner_id', user.id);
    }

    const update: {
      caption?: string | null;
      tags?: string[];
      hidden?: boolean;
      is_cover?: boolean;
      trashed_at?: string | null;
      paired_photo_id?: string | null;
      drive_file_id?: string;
      latitude?: number | null;
      longitude?: number | null;
      accuracy_m?: number | null;
      heading_deg?: number | null;
    } = {};
    if (body.caption !== undefined) update.caption = body.caption || null;
    if (body.driveFileId) update.drive_file_id = body.driveFileId;
    if (body.latitude !== undefined) update.latitude = body.latitude;
    if (body.longitude !== undefined) update.longitude = body.longitude;
    if (body.accuracyM !== undefined) update.accuracy_m = body.accuracyM;
    if (body.headingDeg !== undefined) update.heading_deg = body.headingDeg;
    if (body.tags) update.tags = [...new Set(body.tags.map((tag) => tag.trim()).filter(Boolean))].slice(0, 12);
    if (body.hidden !== undefined) update.hidden = body.hidden;
    if (body.isCover !== undefined) update.is_cover = body.isCover;
    if (body.trash !== undefined) update.trashed_at = body.trash ? new Date().toISOString() : null;
    if (body.pairedPhotoId !== undefined) update.paired_photo_id = body.pairedPhotoId;

    if (Object.keys(update).length === 0) return NextResponse.json({ id: photoId });
    const { error: updateError } = await supabase
      .from('pro_jobsite_photos')
      .update(update)
      .eq('id', photoId)
      .eq('owner_id', user.id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });
    return NextResponse.json({ id: photoId });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid photo' }, { status: 400 });
    return NextResponse.json({ error: 'Could not update the photo' }, { status: 500 });
  }
}
