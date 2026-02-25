import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';

/**
 * POST /api/auth/validate-invitation-code
 * Validates a contractor invitation code (exists, not used, not expired).
 * Returns { valid: boolean, error?: string } for use in signup flows (e.g. ProBot).
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await checkRateLimit(request, 'auth');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = await request.json().catch(() => ({}));
    const rawCode = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';

    if (!rawCode) {
      return NextResponse.json(
        { valid: false, error: 'Invitation code is required for contractor signup.' },
        { status: 200 }
      );
    }

    const serviceRoleClient = createServiceRoleClient();
    const { data: codeRow, error: codeError } = await serviceRoleClient
      .from('contractor_invitation_codes')
      .select('id, expires_at, used_at')
      .eq('code', rawCode)
      .maybeSingle();

    if (codeError || !codeRow) {
      return NextResponse.json(
        { valid: false, error: 'Invalid or expired invitation code.' },
        { status: 200 }
      );
    }
    if (codeRow.used_at) {
      return NextResponse.json(
        { valid: false, error: 'This invitation code has already been used.' },
        { status: 200 }
      );
    }
    const expiresAt = new Date(codeRow.expires_at);
    if (expiresAt <= new Date()) {
      return NextResponse.json(
        { valid: false, error: 'Invalid or expired invitation code.' },
        { status: 200 }
      );
    }

    return NextResponse.json({ valid: true });
  } catch {
    return NextResponse.json(
      { valid: false, error: 'Unable to validate invitation code.' },
      { status: 500 }
    );
  }
}
