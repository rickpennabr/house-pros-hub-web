import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { isValidEmail } from '@/lib/validation';
import { checkRateLimit } from '@/lib/middleware/rateLimit';

/**
 * POST /api/auth/check-email
 * Checks if an email is already registered (for signup flow).
 * Returns { available: boolean }. If available is false, the email is taken.
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
        { error: 'Email is required', available: true },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Invalid email format', available: true },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient();
    const perPage = 500;
    const maxPages = 20;
    let page = 1;

    while (page <= maxPages) {
      const { data, error } = await supabase.auth.admin.listUsers({
        page,
        perPage,
      });

      if (error) {
        return NextResponse.json(
          { error: 'Unable to check email', available: true },
          { status: 500 }
        );
      }

      const found = data?.users?.some(
        (u) => u.email?.toLowerCase() === email
      );
      if (found) {
        return NextResponse.json({ available: false });
      }

      if (!data?.users?.length || data.users.length < perPage) {
        break;
      }
      page++;
    }

    return NextResponse.json({ available: true });
  } catch {
    return NextResponse.json(
      { error: 'Unable to check email', available: true },
      { status: 500 }
    );
  }
}
