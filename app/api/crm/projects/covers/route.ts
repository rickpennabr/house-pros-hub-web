import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasRole } from '@/lib/utils/roles';
import { PRO_DRIVE_BUCKET, PRO_DRIVE_SIGNED_URL_SECONDS } from '@/lib/drive/constants';

function projectRank(status: string): number {
  if (status === 'in_progress') return 0;
  if (status === 'planned') return 1;
  return 2;
}

interface PhotoCandidate {
  project_id: string;
  drive_file_id: string;
  is_cover: boolean;
  taken_at: string;
  hidden: boolean;
}

/** GET /api/crm/projects/covers — one signed photo per customer, cover first then the newest shot. */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const isContractor = await hasRole(user.id, 'contractor');
    if (!isContractor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { data: projects, error: projectError } = await supabase
      .from('pro_crm_projects')
      .select('id, customer_id, status, updated_at')
      .eq('owner_id', user.id)
      .neq('status', 'cancelled')
      .order('updated_at', { ascending: false })
      .limit(1000);
    if (projectError) return NextResponse.json({ error: projectError.message }, { status: 500 });

    const bestByCustomer = new Map<string, { id: string; status: string; updated_at: string }>();
    for (const project of projects ?? []) {
      const current = bestByCustomer.get(project.customer_id);
      if (!current) {
        bestByCustomer.set(project.customer_id, project);
        continue;
      }
      const currentRank = projectRank(current.status) - projectRank(project.status);
      if (currentRank > 0 || (currentRank === 0 && project.updated_at > current.updated_at)) {
        bestByCustomer.set(project.customer_id, project);
      }
    }

    const projectIds = [...bestByCustomer.values()].map((project) => project.id);
    const photos = await loadCandidates(supabase, user.id, projectIds);
    const chosen = choosePhotos(photos, new Set(projectIds));
    const fileIds = [...new Set([...chosen.values()].map((photo) => photo.drive_file_id))];
    const { data: files } = fileIds.length
      ? await supabase.from('pro_drive_files').select('id, mime_type, storage_path').in('id', fileIds)
      : { data: [] };
    const fileMap = new Map((files ?? []).map((file) => [file.id, file]));

    const pending = [...bestByCustomer].flatMap(([customerId, project]) => {
      const photo = chosen.get(project.id);
      const file = photo ? fileMap.get(photo.drive_file_id) : undefined;
      if (!file?.storage_path) return [];
      return [{ customerId, projectId: project.id, path: file.storage_path, mimeType: file.mime_type ?? '' }];
    });
    const covers = (await Promise.all(pending.map(async (item) => {
      const signed = await supabase.storage.from(PRO_DRIVE_BUCKET).createSignedUrl(item.path, PRO_DRIVE_SIGNED_URL_SECONDS);
      if (!signed.data?.signedUrl) return null;
      return {
        customerId: item.customerId,
        projectId: item.projectId,
        url: signed.data.signedUrl,
        mimeType: item.mimeType,
      };
    }))).filter((item) => item !== null);

    return NextResponse.json({ covers });
  } catch {
    return NextResponse.json({ error: 'Could not load project images' }, { status: 500 });
  }
}

async function loadCandidates(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerId: string,
  projectIds: string[],
): Promise<PhotoCandidate[]> {
  const rows: PhotoCandidate[] = [];
  for (let index = 0; index < projectIds.length; index += 100) {
    const chunk = projectIds.slice(index, index + 100);
    const full = await supabase
      .from('pro_jobsite_photos')
      .select('project_id, drive_file_id, is_cover, taken_at, hidden')
      .eq('owner_id', ownerId)
      .in('project_id', chunk)
      .is('trashed_at', null)
      .order('taken_at', { ascending: false })
      .limit(1000);
    if (!full.error) {
      rows.push(...(full.data ?? []));
      continue;
    }
    const basic = await supabase
      .from('pro_jobsite_photos')
      .select('project_id, drive_file_id, taken_at')
      .eq('owner_id', ownerId)
      .in('project_id', chunk)
      .order('taken_at', { ascending: false })
      .limit(1000);
    rows.push(...(basic.data ?? []).map((row) => ({
      ...row,
      is_cover: false,
      hidden: false,
    })));
  }
  return rows;
}

/** Cover image wins. Otherwise the newest visible photo. */
function choosePhotos(photos: PhotoCandidate[], projectIds: Set<string>): Map<string, PhotoCandidate> {
  const chosen = new Map<string, PhotoCandidate>();
  const covers = photos.filter((photo) => photo.is_cover && !photo.hidden && projectIds.has(photo.project_id));
  for (const photo of covers) {
    if (!chosen.has(photo.project_id)) chosen.set(photo.project_id, photo);
  }
  for (const photo of photos) {
    if (photo.hidden || !projectIds.has(photo.project_id) || chosen.has(photo.project_id)) continue;
    chosen.set(photo.project_id, photo);
  }
  return chosen;
}
