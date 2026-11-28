import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { ADMIN_EMAIL } from '@/lib/constants/admin';
import { currentPlanForUser } from '@/lib/billing/plans';
import { PROBOT_TIERS, probotTier } from '@/lib/billing/probot-tiers';

/**
 * GET /api/probot/usage?conversationId=…
 * Today's ProBot use for the chat header: answers and voice replies used / allowed, the plan, and when it resets.
 * Same count as the server limit (lib/chat/probot-usage.ts): the person's hub messages since midnight UTC.
 */
export async function GET(request: NextRequest) {
  const conversationId = request.nextUrl.searchParams.get('conversationId');
  let userId: string | undefined;
  let admin = false;
  try {
    const session = await createClient();
    const { data: { user } } = await session.auth.getUser();
    userId = user?.id;
    admin = Boolean(user?.email && user.email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase());
  } catch {
    // Guest.
  }
  const planSlug = userId ? await currentPlanForUser(userId).then((row) => row.plan.slug).catch(() => 'free') : 'free';
  const tier = userId ? probotTier(planSlug) : PROBOT_TIERS.free;

  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const resetsAt = new Date(start.getTime() + 24 * 60 * 60 * 1000).toISOString();

  let answers = 0;
  let voice = 0;
  if (conversationId && /^[0-9a-f-]{36}$/i.test(conversationId)) {
    const supabase = createServiceRoleClient();
    const { data } = await supabase
      .from('probot_messages')
      .select('attachments')
      .eq('conversation_id', conversationId)
      .eq('sender', 'visitor')
      .is('business_id', null)
      .gte('created_at', start.toISOString())
      .limit(1000);
    const rows = (data ?? []) as { attachments?: unknown }[];
    answers = rows.length;
    voice = rows.filter(
      (row) => Array.isArray(row.attachments) && row.attachments.some((att) => (att as { name?: string })?.name?.startsWith('voice-note'))
    ).length;
  }

  return NextResponse.json({
    plan: planSlug,
    unlimited: admin,
    signedIn: Boolean(userId),
    answers: { used: answers, limit: tier.dailyAnswers },
    voice: { used: voice, limit: tier.dailyVoice },
    resetsAt,
  });
}
