import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { driveErrorResponse } from '@/lib/drive/http';
import { deleteDriveFolder, renameDriveFolder, requireDriveUser } from '@/lib/drive/server';

const patchSchema = z.object({ name: z.string().trim().min(1).max(80) });

/** PATCH /api/prodrive/folders/[id] — rename a folder. */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = patchSchema.parse(await request.json());
    const { supabase, user } = await requireDriveUser();
    await renameDriveFolder(supabase, user.id, id, body.name);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid folder' }, { status: 400 });
    return driveErrorResponse(error);
  }
}

/** DELETE /api/prodrive/folders/[id] — delete an empty folder. */
export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { supabase, user } = await requireDriveUser();
    await deleteDriveFolder(supabase, user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return driveErrorResponse(error);
  }
}
