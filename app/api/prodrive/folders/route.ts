import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { driveErrorResponse } from '@/lib/drive/http';
import { createDriveFolder, ensureFolderPath, requireDriveUser } from '@/lib/drive/server';

const createSchema = z.object({
  ownerType: z.enum(['user', 'business']),
  ownerId: z.string().uuid(),
  parentId: z.string().uuid().nullable(),
  name: z.string().trim().min(1).max(80),
});

const ensureSchema = z.object({
  ownerType: z.enum(['user', 'business']),
  ownerId: z.string().uuid(),
  names: z.array(z.string().trim().min(1).max(80)).min(1).max(4),
});

/** POST /api/prodrive/folders — create one folder, or ensure a nested path. */
export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const { supabase, user } = await requireDriveUser();
    if (Array.isArray(json.names)) {
      const body = ensureSchema.parse(json);
      const folderId = await ensureFolderPath(supabase, user.id, body.ownerType, body.ownerId, body.names);
      return NextResponse.json({ folderId });
    }
    const body = createSchema.parse(json);
    const folder = await createDriveFolder(supabase, user.id, body.ownerType, body.ownerId, body.parentId, body.name);
    return NextResponse.json({ folder });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid folder' }, { status: 400 });
    return driveErrorResponse(error);
  }
}
