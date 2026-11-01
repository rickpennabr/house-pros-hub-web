import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { driveErrorResponse } from '@/lib/drive/http';
import { deleteDriveFile, moveDriveFile, renameDriveFile, requireDriveUser } from '@/lib/drive/server';

const patchSchema = z.object({
  name: z.string().trim().min(1).max(180).optional(),
  folderId: z.string().uuid().nullable().optional(),
});

/** PATCH /api/prodrive/files/[id] — rename or move within the same drive. */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = patchSchema.parse(await request.json());
    const { supabase, user } = await requireDriveUser();
    if (body.name) await renameDriveFile(supabase, user.id, id, body.name);
    if (body.folderId !== undefined) await moveDriveFile(supabase, user.id, id, body.folderId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid update' }, { status: 400 });
    return driveErrorResponse(error);
  }
}

/** DELETE /api/prodrive/files/[id] — remove the blob and the catalog row. */
export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { supabase, user } = await requireDriveUser();
    await deleteDriveFile(supabase, user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return driveErrorResponse(error);
  }
}
