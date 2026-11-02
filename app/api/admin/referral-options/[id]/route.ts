import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { ADMIN_EMAIL } from '@/lib/constants/admin';

async function requireAdmin() {
  const supabaseAuth = await createClient();
  const {
    data: { user },
    error,
  } = await supabaseAuth.auth.getUser();
  if (error || !user?.email) {
    return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) };
  }
  if (user.email.trim().toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { user };
}

/**
 * DELETE /api/admin/referral-options/[id]
 * Remove an admin-added referral choice. Past answers that used it are kept.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Option id is required' }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    const { error } = await supabase.from('referral_options').delete().eq('id', id);

    if (error) {
      console.error('DELETE /api/admin/referral-options error:', error);
      return NextResponse.json({ error: 'Failed to remove option' }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('DELETE /api/admin/referral-options error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
