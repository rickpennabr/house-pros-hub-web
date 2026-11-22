import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/blog/admin';
import { getStripe, subscriptionPeriodEnd } from '@/lib/billing/stripe';
import {
  loadPlans,
  monthlyValueCents,
  subscriptionGrantsPlan,
  type HubSubscription,
} from '@/lib/billing/plans';

type Service = ReturnType<typeof createServiceRoleClient>;

async function findUserIdByEmail(service: Service, email: string): Promise<string | null> {
  const target = email.trim().toLowerCase();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return null;
    const hit = data.users.find((user) => user.email?.toLowerCase() === target);
    if (hit) return hit.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

/**
 * GET /api/admin/billing/subscriptions
 * Every company subscription with the owner's name and email, plus totals. Admin only.
 */
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;
  const service = createServiceRoleClient();
  const plans = await loadPlans(service, true);
  const { data, error: loadError } = await service
    .from('hub_subscriptions')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(500);
  if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 });
  const rows = (data ?? []) as HubSubscription[];

  const ids = rows.map((row) => row.user_id);
  const { data: profiles } = ids.length
    ? await service.from('profiles').select('id, first_name, last_name, business_id').in('id', ids)
    : { data: [] };
  const businessIds = [...new Set((profiles ?? []).map((p) => p.business_id).filter((id): id is string => Boolean(id)))];
  const { data: businesses } = businessIds.length
    ? await service.from('businesses').select('id, business_name').in('id', businessIds)
    : { data: [] };
  const businessName = new Map((businesses ?? []).map((b) => [b.id as string, (b as { business_name?: string | null }).business_name ?? '']));
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const emails = new Map<string, string>();
  await Promise.all(
    ids.slice(0, 200).map(async (id) => {
      const { data: auth } = await service.auth.admin.getUserById(id);
      if (auth?.user?.email) emails.set(id, auth.user.email);
    })
  );

  let mrrCents = 0;
  const byPlan: Record<string, number> = {};
  let pastDue = 0;
  let canceling = 0;
  let comped = 0;
  const subscriptions = rows.map((row) => {
    const profile = profileById.get(row.user_id);
    const granted = subscriptionGrantsPlan(row);
    const plan = plans.find((p) => p.slug === row.plan);
    if (granted) {
      byPlan[row.plan] = (byPlan[row.plan] ?? 0) + 1;
      if (!row.comped) mrrCents += monthlyValueCents(plan, row.billing_interval);
    }
    if (row.status === 'past_due') pastDue += 1;
    if (row.cancel_at_period_end) canceling += 1;
    if (row.comped && granted) comped += 1;
    return {
      ...row,
      granted,
      planName: plan?.name ?? row.plan,
      email: emails.get(row.user_id) ?? null,
      name: [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || null,
      company: profile?.business_id ? businessName.get(profile.business_id) || null : null,
    };
  });

  return NextResponse.json({
    subscriptions,
    stats: { mrrCents, byPlan, paying: Object.values(byPlan).reduce((a, b) => a + b, 0) - comped, pastDue, canceling, comped },
  });
}

const actionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('comp'),
    userId: z.string().uuid().optional(),
    email: z.string().email().optional(),
    plan: z.string().regex(/^[a-z0-9-]{2,30}$/),
    until: z.string().datetime().nullable().optional(),
    note: z.string().max(1000).optional(),
  }),
  z.object({ action: z.literal('uncomp'), userId: z.string().uuid() }),
  z.object({ action: z.literal('cancel_at_period_end'), userId: z.string().uuid() }),
  z.object({ action: z.literal('resume'), userId: z.string().uuid() }),
  z.object({ action: z.literal('cancel_now'), userId: z.string().uuid() }),
  z.object({ action: z.literal('note'), userId: z.string().uuid(), note: z.string().max(1000) }),
]);

/**
 * PATCH /api/admin/billing/subscriptions
 * Admin actions: give a plan for free (comp), end a comp, cancel or resume a Stripe subscription, notes.
 */
export async function PATCH(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
  const input = parsed.data;
  const service = createServiceRoleClient();

  try {
    if (input.action === 'comp') {
      const userId = input.userId ?? (input.email ? await findUserIdByEmail(service, input.email) : null);
      if (!userId) return NextResponse.json({ error: 'No account found with that email.' }, { status: 404 });
      const plans = await loadPlans(service, true);
      if (!plans.some((plan) => plan.slug === input.plan)) return NextResponse.json({ error: 'Unknown plan' }, { status: 400 });
      const { data: existing } = await service.from('hub_subscriptions').select('*').eq('user_id', userId).maybeSingle();
      const { error: saveError } = await service.from('hub_subscriptions').upsert({
        user_id: userId,
        stripe_customer_id: existing?.stripe_customer_id ?? null,
        stripe_subscription_id: existing?.stripe_subscription_id ?? null,
        plan: input.plan,
        status: 'active',
        comped: input.plan !== 'free',
        comped_until: input.until ?? null,
        admin_note: input.note ?? existing?.admin_note ?? null,
      });
      if (saveError) throw new Error(saveError.message);
      return NextResponse.json({ ok: true });
    }

    const { data: sub } = await service.from('hub_subscriptions').select('*').eq('user_id', input.userId).maybeSingle();
    if (!sub) return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });

    if (input.action === 'note') {
      await service.from('hub_subscriptions').update({ admin_note: input.note || null }).eq('user_id', input.userId);
      return NextResponse.json({ ok: true });
    }

    if (input.action === 'uncomp') {
      // Back to whatever Stripe says, or Free.
      let plan = 'free';
      let status: HubSubscription['status'] = 'active';
      if (sub.stripe_subscription_id && process.env.STRIPE_SECRET_KEY) {
        const stripeSub = await getStripe().subscriptions.retrieve(sub.stripe_subscription_id).catch(() => null);
        if (stripeSub && stripeSub.status !== 'canceled' && stripeSub.metadata?.plan) {
          plan = stripeSub.metadata.plan;
          status = stripeSub.status === 'trialing' ? 'trialing' : stripeSub.status === 'past_due' ? 'past_due' : 'active';
        }
      }
      await service.from('hub_subscriptions').update({ comped: false, comped_until: null, plan, status }).eq('user_id', input.userId);
      return NextResponse.json({ ok: true });
    }

    if (!sub.stripe_subscription_id) return NextResponse.json({ error: 'This company has no Stripe subscription.' }, { status: 400 });
    const stripe = getStripe();
    if (input.action === 'cancel_now') {
      const canceled = await stripe.subscriptions.cancel(sub.stripe_subscription_id);
      await service
        .from('hub_subscriptions')
        .update({ status: 'canceled', plan: sub.comped ? sub.plan : 'free', cancel_at_period_end: false, current_period_end: subscriptionPeriodEnd(canceled) })
        .eq('user_id', input.userId);
      return NextResponse.json({ ok: true });
    }
    const cancelAtEnd = input.action === 'cancel_at_period_end';
    const updated = await stripe.subscriptions.update(sub.stripe_subscription_id, { cancel_at_period_end: cancelAtEnd });
    await service
      .from('hub_subscriptions')
      .update({ cancel_at_period_end: cancelAtEnd, current_period_end: subscriptionPeriodEnd(updated) })
      .eq('user_id', input.userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/admin/billing/subscriptions', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Action failed' }, { status: 500 });
  }
}
