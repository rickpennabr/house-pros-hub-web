import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ADMIN_EMAIL } from '@/lib/constants/admin';

/**
 * GET /api/auth/is-admin
 * Returns whether the current session belongs to an admin (for client-side UI).
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.email) {
      return NextResponse.json({ isAdmin: false }, { status: 200 });
    }

    const isAdmin =
      user.email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();

    return NextResponse.json({ isAdmin }, { status: 200 });
  } catch {
    return NextResponse.json({ isAdmin: false }, { status: 200 });
  }
}
