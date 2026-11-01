import { NextResponse } from 'next/server';
import { driveErrorResponse } from '@/lib/drive/http';
import { listOwnedBusinesses, requireDriveUser } from '@/lib/drive/server';

/** GET /api/prodrive/businesses — businesses the signed-in user can use as a drive. */
export async function GET() {
  try {
    const { supabase, user } = await requireDriveUser();
    const businesses = await listOwnedBusinesses(supabase, user.id);
    return NextResponse.json({
      businesses: businesses.map((row) => ({ id: row.id, name: row.business_name })),
    });
  } catch (error) {
    return driveErrorResponse(error);
  }
}
