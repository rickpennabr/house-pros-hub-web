import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { driveErrorResponse } from '@/lib/drive/http';
import { assertProDriveQuota, requireDriveUser } from '@/lib/drive/server';

const bodySchema = z.object({
  additionalBytes: z.number().int().nonnegative(),
});

/** POST /api/prodrive/quota — refuse an upload that would pass the included cap. */
export async function POST(request: NextRequest) {
  try {
    const body = bodySchema.parse(await request.json());
    const { supabase, user } = await requireDriveUser();
    const usage = await assertProDriveQuota(supabase, user.id, body.additionalBytes);
    return NextResponse.json({ usage });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid quota request' }, { status: 400 });
    }
    return driveErrorResponse(error);
  }
}
