import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { findInvitationCode, invitationCodeBlockReason, parseInvitationRole } from '@/lib/auth/invitationCodes';

/**
 * POST /api/auth/validate-invitation-code
 * Validates a contractor or realtor invitation code (exists, not used, not expired).
 * Body: { code: string, role?: 'contractor' | 'realtor' | 'installer' }. Default role is contractor.
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
    const role = parseInvitationRole(body.role);

    if (!rawCode) {
      return NextResponse.json(
        { valid: false, error: 'Invitation code is required.' },
        { status: 200 }
      );
    }

    const serviceRoleClient = createServiceRoleClient();
    const { row: codeRow, error: codeError } = await findInvitationCode(serviceRoleClient, role, rawCode);
    const blockReason = codeError ? 'Invalid or expired invitation code.' : invitationCodeBlockReason(codeRow);
    if (blockReason) {
      return NextResponse.json(
        { valid: false, error: blockReason },
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
