import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { driveErrorResponse } from '@/lib/drive/http';
import { registerProDriveFile, requireDriveUser } from '@/lib/drive/server';

const bodySchema = z.object({
  id: z.string().uuid(),
  ownerType: z.enum(['user', 'business']),
  ownerId: z.string().uuid(),
  folderId: z.string().uuid().nullable(),
  name: z.string().trim().min(1).max(180),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  storagePath: z.string().min(1),
});

/** POST /api/prodrive/files — catalog row after the client upload. */
export async function POST(request: NextRequest) {
  try {
    const body = bodySchema.parse(await request.json());
    const { supabase, user } = await requireDriveUser();
    const file = await registerProDriveFile(supabase, user.id, body);
    return NextResponse.json({ file });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid file' }, { status: 400 });
    }
    return driveErrorResponse(error);
  }
}
