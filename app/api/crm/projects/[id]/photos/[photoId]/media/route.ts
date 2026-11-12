import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasRole } from '@/lib/utils/roles';
import { PRO_DRIVE_BUCKET } from '@/lib/drive/constants';
import { remuxQuickTimeToMp4 } from '@/lib/media/remux-quicktime';

const cache = new Map<string, Uint8Array>();
const CACHE_LIMIT = 8;

async function requireContractor() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), supabase, user: null };
  const isContractor = await hasRole(user.id, 'contractor');
  if (!isContractor) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), supabase, user: null };
  return { error: null, supabase, user };
}

/** GET /api/crm/projects/[id]/photos/[photoId]/media — QuickTime clip as an MP4 Chrome can play. */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string; photoId: string }> }) {
  try {
    const { error, supabase, user } = await requireContractor();
    if (error || !user) return error!;
    const { id, photoId } = await context.params;
    const { data: photo } = await supabase
      .from('pro_jobsite_photos')
      .select('id, drive_file_id')
      .eq('id', photoId)
      .eq('project_id', id)
      .eq('owner_id', user.id)
      .maybeSingle();
    if (!photo) return NextResponse.json({ error: 'Photo not found' }, { status: 404 });

    const { data: file } = await supabase
      .from('pro_drive_files')
      .select('id, mime_type, storage_path')
      .eq('id', photo.drive_file_id)
      .maybeSingle();
    if (!file?.storage_path) return NextResponse.json({ error: 'File not found' }, { status: 404 });

    const mp4 = await loadMp4(supabase, file.id, file.storage_path);
    if (!mp4) return NextResponse.json({ error: 'Could not play the video' }, { status: 500 });
    return ranged(request, mp4);
  } catch {
    return NextResponse.json({ error: 'Could not play the video' }, { status: 500 });
  }
}

async function loadMp4(
  supabase: Awaited<ReturnType<typeof createClient>>,
  fileId: string,
  storagePath: string,
): Promise<Uint8Array | null> {
  const cached = cache.get(fileId);
  if (cached) return cached;
  const signed = await supabase.storage.from(PRO_DRIVE_BUCKET).createSignedUrl(storagePath, 120);
  if (!signed.data?.signedUrl) return null;
  const downloaded = await fetch(signed.data.signedUrl);
  if (!downloaded.ok) return null;
  const original = new Uint8Array(await downloaded.arrayBuffer());
  const mp4 = remuxQuickTimeToMp4(original) ?? original;
  cache.set(fileId, mp4);
  if (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  return mp4;
}

function ranged(request: NextRequest, bytes: Uint8Array): NextResponse {
  const headers = {
    'Content-Type': 'video/mp4',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, max-age=3600',
  };
  const range = request.headers.get('range');
  const match = range ? /bytes=(\d+)-(\d*)/.exec(range) : null;
  if (!match) {
    return new NextResponse(bytes, {
      status: 200,
      headers: { ...headers, 'Content-Length': String(bytes.length) },
    });
  }
  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : bytes.length - 1;
  if (start > end || end >= bytes.length) {
    return new NextResponse(null, {
      status: 416,
      headers: { ...headers, 'Content-Range': `bytes */${bytes.length}` },
    });
  }
  const slice = bytes.subarray(start, end + 1);
  return new NextResponse(slice, {
    status: 206,
    headers: {
      ...headers,
      'Content-Length': String(slice.length),
      'Content-Range': `bytes ${start}-${end}/${bytes.length}`,
    },
  });
}
