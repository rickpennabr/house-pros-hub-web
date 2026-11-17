import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireCrmScope } from '@/lib/crm/crm-scope';
import { PRO_DRIVE_BUCKET, PRO_DRIVE_SIGNED_URL_SECONDS } from '@/lib/drive/constants';

const postSchema = z.object({
  driveFileId: z.string().uuid(),
  phase: z.enum(['before', 'after']),
  kind: z.enum(['photo', 'video']).optional(),
  caption: z.string().trim().max(500).optional(),
  orientation: z.enum(['portrait', 'landscape']).nullable().optional(),
});

/**
 * GET /api/crm/maintenance/visits/[id]/media
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { error, scope } = await requireCrmScope();
    if (error || !scope) return error!;
    const { id } = await context.params;

    const { data: visit } = await scope.supabase
      .from('pro_crm_maintenance_visits')
      .select('id')
      .eq('id', id)
      .eq('owner_id', scope.ownerId)
      .maybeSingle();
    if (!visit) return NextResponse.json({ error: 'Visit not found' }, { status: 404 });

    const { data: rows, error: queryError } = await scope.supabase
      .from('pro_crm_maintenance_visit_media')
      .select('id, phase, kind, drive_file_id, caption, orientation, sort_order, created_at')
      .eq('visit_id', id)
      .order('sort_order', { ascending: true });
    if (queryError) {
      return NextResponse.json({ error: queryError.message }, { status: 500 });
    }

    const fileIds = (rows ?? []).map((row) => row.drive_file_id);
    const { data: files } = fileIds.length
      ? await scope.supabase.from('pro_drive_files').select('id, name, mime_type, storage_path').in('id', fileIds)
      : { data: [] };
    const fileMap = new Map((files ?? []).map((file) => [file.id, file]));

    const media = [];
    for (const row of rows ?? []) {
      const file = fileMap.get(row.drive_file_id);
      let url: string | null = null;
      if (file?.storage_path) {
        const signed = await scope.supabase.storage
          .from(PRO_DRIVE_BUCKET)
          .createSignedUrl(file.storage_path, PRO_DRIVE_SIGNED_URL_SECONDS);
        url = signed.data?.signedUrl ?? null;
      }
      media.push({
        id: row.id,
        phase: row.phase,
        kind: row.kind,
        driveFileId: row.drive_file_id,
        caption: row.caption,
        orientation: row.orientation,
        sortOrder: row.sort_order,
        createdAt: row.created_at,
        name: file?.name ?? '',
        mimeType: file?.mime_type ?? '',
        url,
      });
    }

    return NextResponse.json({
      businessId: scope.businessId,
      media,
    });
  } catch (error) {
    console.error('GET /api/crm/maintenance/visits/[id]/media', error);
    return NextResponse.json({ error: 'Failed to load media' }, { status: 500 });
  }
}

/**
 * POST /api/crm/maintenance/visits/[id]/media
 * Attach a ProDrive file (photo or video) to the visit package.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { error, scope } = await requireCrmScope();
    if (error || !scope) return error!;
    const { id } = await context.params;

    const parsed = postSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid media' }, { status: 400 });
    }

    const { data: visit } = await scope.supabase
      .from('pro_crm_maintenance_visits')
      .select('id, status')
      .eq('id', id)
      .eq('owner_id', scope.ownerId)
      .maybeSingle();
    if (!visit) return NextResponse.json({ error: 'Visit not found' }, { status: 404 });
    if (visit.status !== 'in_progress') {
      return NextResponse.json({ error: 'Visit is closed' }, { status: 400 });
    }

    const { data: file } = await scope.supabase
      .from('pro_drive_files')
      .select('id, mime_type, name')
      .eq('id', parsed.data.driveFileId)
      .maybeSingle();
    if (!file) return NextResponse.json({ error: 'Drive file not found' }, { status: 404 });

    const mime = (file.mime_type ?? '').toLowerCase();
    const kind =
      parsed.data.kind ??
      (mime.startsWith('video/') || file.name.toLowerCase().match(/\.(mp4|webm|mov)$/)
        ? 'video'
        : 'photo');

    const { data: maxRow } = await scope.supabase
      .from('pro_crm_maintenance_visit_media')
      .select('sort_order')
      .eq('visit_id', id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: row, error: insertError } = await scope.supabase
      .from('pro_crm_maintenance_visit_media')
      .insert({
        visit_id: id,
        owner_id: scope.ownerId,
        phase: parsed.data.phase,
        kind,
        drive_file_id: parsed.data.driveFileId,
        caption: parsed.data.caption ?? null,
        orientation: parsed.data.orientation ?? null,
        sort_order: (maxRow?.sort_order ?? -1) + 1,
      })
      .select('id, phase, kind, drive_file_id, caption, orientation, sort_order, created_at')
      .single();

    if (insertError || !row) {
      return NextResponse.json({ error: insertError?.message ?? 'Could not save media' }, { status: 500 });
    }

    return NextResponse.json(
      {
        media: {
          id: row.id,
          phase: row.phase,
          kind: row.kind,
          driveFileId: row.drive_file_id,
          caption: row.caption,
          orientation: row.orientation,
          sortOrder: row.sort_order,
          createdAt: row.created_at,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/crm/maintenance/visits/[id]/media', error);
    return NextResponse.json({ error: 'Failed to save media' }, { status: 500 });
  }
}
