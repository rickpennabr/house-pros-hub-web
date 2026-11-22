import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ADMIN_EMAIL } from '@/lib/constants/admin';
import { adminSessionVerified } from '@/lib/auth/admin-mfa';

export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null };
  }
  if (user.email?.toLowerCase().trim() !== ADMIN_EMAIL.toLowerCase().trim()) {
    return {
      error: NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 }),
      user: null,
    };
  }
  // Second layer behind proxy.ts: the admin session must have finished two-step sign-in.
  if (!(await adminSessionVerified(supabase))) {
    return {
      error: NextResponse.json({ error: 'Finish two-step sign-in first.', code: 'admin_mfa_required' }, { status: 401 }),
      user: null,
    };
  }
  return { error: null, user };
}

export function isMissingBlogStorage(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === '42P01' || error.code === 'PGRST205' || /blog_posts/i.test(error.message ?? '');
}
