import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';

/**
 * POST /api/auth/validate-invitation-code
 * Validates a contractor or realtor invitation code (exists, not used, not expired).
 * Body: { code: string, role?: 'contractor' | 'realtor' }. Default role is contractor.
 * Returns { valid: boolean, error?: string } for use in signup flows.
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await checkRateLimit(request, 'auth');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = await request.json().catch(() => ({}));
    const rawCode = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
    const role = body.role === 'realtor' ? 'realtor' : 'contractor';

    if (!rawCode) {
      return NextResponse.json(
        { valid: false, error: 'Invitation code is required.' },
        { status: 200 }
      );
    }

    const serviceRoleClient = createServiceRoleClient();
    const table = role === 'realtor' ? 'realtor_invitation_codes' : 'contractor_invitation_codes';
    const { data: codeRow, error: codeError } = await serviceRoleClient
      .from(table)
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
