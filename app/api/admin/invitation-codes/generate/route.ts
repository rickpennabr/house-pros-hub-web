import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { ADMIN_EMAIL } from '@/lib/constants/admin';

const CODE_LENGTH = 10;
const EXPIRY_DAYS = 30;

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null };
  }
  if (user.email?.toLowerCase().trim() !== ADMIN_EMAIL.toLowerCase().trim()) {
    return { error: NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 }), user: null };
  }
  return { error: null, user };
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += chars[bytes[i]! % chars.length];
  }
  return code;
}

/**
 * POST /api/admin/invitation-codes/generate
 * Generate a new one-time contractor invitation code. Admin only.
 * Returns { code, expiresAt }.
 */
export async function POST() {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    const service = createServiceRoleClient();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    let code = generateCode();
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      const { data, error } = await service
        .from('contractor_invitation_codes')
        .insert({
          code,
          expires_at: expiresAt.toISOString(),
        })
        .select('code, expires_at')
        .single();

      if (!error) {
        return NextResponse.json({
          code: data.code,
          expiresAt: data.expires_at,
        });
      }

      if (error.code === '23505') {
        code = generateCode();
        attempts++;
        continue;
      }

      console.error('[invitation-codes/generate] insert error:', error);
      return NextResponse.json(
        { error: 'Failed to generate invitation code' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to generate unique code' },
      { status: 500 }
    );
  } catch (e) {
    console.error('[invitation-codes/generate] error:', e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
