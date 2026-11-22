import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { currentPlanForUser, loadPlans } from '@/lib/billing/plans';

/**
 * GET /api/billing/plans
 * Active plans for the pricing page, and the signed-in user's current plan.
 */
export async function GET() {
  try {
    const service = createServiceRoleClient();
    const plans = (await loadPlans(service)).map((plan) => ({
      slug: plan.slug,
      name: plan.name,
      tagline: plan.tagline,
      monthlyPriceCents: plan.monthly_price_cents,
      yearlyPriceCents: plan.yearly_price_cents,
      includedUsers: plan.included_users,
      extraUserPriceCents: plan.extra_user_price_cents,
      storageGb: Number(plan.storage_gb),
      protradesLimit: plan.protrades_limit,
      trialDays: plan.trial_days,
      features: plan.features,
      highlight: plan.highlight,
      purchasable: Boolean(plan.stripe_monthly_price_id || plan.stripe_yearly_price_id),
      hasMonthly: Boolean(plan.stripe_monthly_price_id),
      hasYearly: Boolean(plan.stripe_yearly_price_id),
    }));

    const session = await createClient();
    const { data: { user } } = await session.auth.getUser();
    let current: null | {
      plan: string;
      status: string;
      interval: string | null;
      periodEnd: string | null;
      cancelAtPeriodEnd: boolean;
      comped: boolean;
      hasStripe: boolean;
    } = null;
    if (user) {
      const { plan, subscription } = await currentPlanForUser(user.id, service);
      current = {
        plan: plan.slug,
        status: subscription?.status ?? 'active',
        interval: subscription?.billing_interval ?? null,
        periodEnd: subscription?.comped ? subscription.comped_until : subscription?.current_period_end ?? null,
        cancelAtPeriodEnd: Boolean(subscription?.cancel_at_period_end),
        comped: Boolean(subscription?.comped),
        hasStripe: Boolean(subscription?.stripe_customer_id),
      };
    }
    return NextResponse.json({ plans, current, signedIn: Boolean(user) });
  } catch (err) {
    console.error('GET /api/billing/plans', err);
    return NextResponse.json({ error: 'Could not load plans' }, { status: 500 });
  }
}
