import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/middleware/rateLimit';
import { forgetTwoStep, sendTwoStepNotice, verifiedFactorCount } from '@/lib/auth/two-step';

/**
 * POST /api/auth/two-step  { event: 'enabled' | 'disabled' }
 * Called by the settings panel after the person added or removed an authenticator (that change
 * itself happens with Supabase directly). Refreshes the server's cached answer and emails a
 * security notice. The notice is sent only when Supabase confirms the new state.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const limited = await checkRateLimit(request, 'auth', user.id);
  if (limited) return limited;

  const body = (await request.json().catch(() => ({}))) as { event?: unknown };
  forgetTwoStep(user.id);
  const count = await verifiedFactorCount(user.id).catch(() => null);
  if (count === null) return NextResponse.json({ ok: true });
  const on = count > 0;
  if (user.email && ((body.event === 'enabled' && on) || (body.event === 'disabled' && !on))) {
    await sendTwoStepNotice(user.email, on);
  }
  return NextResponse.json({ ok: true, enabled: on, authenticators: count });
}
