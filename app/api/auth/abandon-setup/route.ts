import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { logger } from '@/lib/utils/logger';

/**
 * POST /api/auth/abandon-setup
 * Google only proves identity. A pending customer is not finished until
 * /signup/finish saves the missing 3-step fields. Leaving that screen deletes
 * the unfinished auth user so they are not a Hub member yet.
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await checkRateLimit(request, 'auth');
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ status: 'skip' });
    }

    const service = createServiceRoleClient();
    const { data: profile, error: profileError } = await service
      .from('profiles')
      .select('account_setup_pending, business_id, company_role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      logger.warn('[Abandon setup] profile read failed', { userId: user.id, error: profileError.message });
      return NextResponse.json({ status: 'skip' });
    }

    if (!profile?.account_setup_pending) {
      return NextResponse.json({ status: 'complete' });
    }

    // Never delete someone who already has a business or company role.
    if (profile.business_id || profile.company_role?.trim()) {
      return NextResponse.json({ status: 'skip' });
    }

    const { count, error: businessError } = await service
      .from('businesses')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', user.id);

    if (businessError) {
      logger.warn('[Abandon setup] business read failed', { userId: user.id, error: businessError.message });
      return NextResponse.json({ status: 'skip' });
    }
    if ((count ?? 0) > 0) {
      return NextResponse.json({ status: 'skip' });
    }

    await service.from('addresses').delete().eq('user_id', user.id);
    await service.from('user_roles').delete().eq('user_id', user.id);
    await service.from('profiles').delete().eq('id', user.id);

    const { error: deleteError } = await service.auth.admin.deleteUser(user.id);
    if (deleteError) {
      logger.error('[Abandon setup] delete user failed', { userId: user.id, error: deleteError.message });
      return NextResponse.json({ error: 'Could not discard this signup.' }, { status: 500 });
    }

    try {
      await supabase.auth.signOut();
    } catch {
      // Account is already gone.
    }

    return NextResponse.json({ status: 'abandoned' });
  } catch (error) {
    logger.error('[Abandon setup] unhandled', {}, error as Error);
    return NextResponse.json({ error: 'Could not discard this signup.' }, { status: 500 });
  }
}
