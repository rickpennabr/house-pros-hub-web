import { NextResponse } from 'next/server';
import { driveErrorResponse } from '@/lib/drive/http';
import { getAccountDriveUsage, requireDriveUser } from '@/lib/drive/server';

/** GET /api/prodrive/usage — included storage, plan, and overage flag. */
export async function GET() {
  try {
    const { supabase, user } = await requireDriveUser();
    const usage = await getAccountDriveUsage(supabase, user.id);
    return NextResponse.json({ usage });
  } catch (error) {
    return driveErrorResponse(error);
  }
}
