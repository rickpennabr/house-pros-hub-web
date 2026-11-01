import { NextRequest, NextResponse } from 'next/server';
import { driveErrorResponse, parseOwner } from '@/lib/drive/http';
import { listDriveFolder, requireDriveUser } from '@/lib/drive/server';

/** GET /api/prodrive/folder — folders and files in one directory. */
export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const ownerType = parseOwner(params.get('ownerType'));
    const ownerId = params.get('ownerId');
    const folderId = params.get('folderId');
    if (!ownerType || !ownerId) {
      return NextResponse.json({ error: 'Owner is required' }, { status: 400 });
    }
    const { supabase, user } = await requireDriveUser();
    const listing = await listDriveFolder(supabase, user.id, ownerType, ownerId, folderId || null);
    return NextResponse.json(listing);
  } catch (error) {
    return driveErrorResponse(error);
  }
}
