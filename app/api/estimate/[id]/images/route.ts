import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { ADMIN_EMAIL } from '@/lib/constants/admin';
import { signDriveFilesForStaff } from '@/lib/drive/server';

/**
 * GET /api/estimate/[id]/images
 * Signed ProDrive URLs for the homeowner who submitted the estimate, or the admin.
 */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const service = createServiceRoleClient();
    const { data: estimate } = await service
      .from('estimates')
      .select('user_id, project_drive_file_ids')
      .eq('id', id)
      .maybeSingle();
    if (!estimate) return NextResponse.json({ error: 'Estimate not found' }, { status: 404 });

    const isAdmin = user.email?.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
    if (!isAdmin && estimate.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const images = await signDriveFilesForStaff(estimate.project_drive_file_ids ?? []);
    return NextResponse.json({ images });
  } catch {
    return NextResponse.json({ error: 'Could not open photos' }, { status: 500 });
  }
}
