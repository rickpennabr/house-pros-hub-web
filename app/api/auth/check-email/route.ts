import { NextRequest, NextResponse } from 'next/server';
import { isValidEmail } from '@/lib/validation';
import { checkRateLimit } from '@/lib/middleware/rateLimit';

/**
 * POST /api/auth/check-email
 * Checks if an email is already registered (for signup flow).
 * Returns { available: boolean }. If available is false, the email is taken.
 * Looks up that address only. Does not page through the user list.
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await checkRateLimit(request, 'auth');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Unable to check email' }, { status: 500 });
    }

    const lookup = await fetch(
      `${supabaseUrl}/auth/v1/admin/users?filter=${encodeURIComponent(email)}`,
      {
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
        },
        cache: 'no-store',
      }
    );

    if (!lookup.ok) {
      return NextResponse.json({ error: 'Unable to check email' }, { status: 500 });
    }

    const payload = (await lookup.json()) as { users?: { email?: string | null }[] };
    const found = (payload.users ?? []).some((user) => user.email?.toLowerCase() === email);
    return NextResponse.json({ available: !found });
  } catch {
    return NextResponse.json(
      { error: 'Unable to check email' },
      { status: 500 }
    );
  }
}
