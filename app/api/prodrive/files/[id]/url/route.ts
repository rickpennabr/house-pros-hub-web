import { NextRequest, NextResponse } from 'next/server';
import { driveErrorResponse } from '@/lib/drive/http';
import { getDriveSignedUrl, requireDriveUser } from '@/lib/drive/server';

/** GET /api/prodrive/files/[id]/url — short-lived download URL. */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { supabase, user } = await requireDriveUser();
    const url = await getDriveSignedUrl(supabase, user.id, id);
    return NextResponse.json({ url });
  } catch (error) {
    return driveErrorResponse(error);
  }
}
