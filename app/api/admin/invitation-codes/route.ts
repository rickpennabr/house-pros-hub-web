import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { ADMIN_EMAIL } from '@/lib/constants/admin';

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

/**
 * GET /api/admin/invitation-codes
 * List recent contractor invitation codes. Admin only.
 * Query: limit (default 50)
 */
export async function GET(request: NextRequest) {
  try {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));

    const service = createServiceRoleClient();
    const { data: codes, error } = await service
      .from('contractor_invitation_codes')
      .select('id, code, created_at, expires_at, used_at, used_by')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[invitation-codes GET] error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch invitation codes' },
        { status: 500 }
      );
    }

    return NextResponse.json({ codes: codes ?? [] });
  } catch (e) {
    console.error('[invitation-codes GET] error:', e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
