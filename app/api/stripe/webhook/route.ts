import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { applyInvoiceCheckoutSession } from '@/lib/billing/invoice-checkout';
import { getStripe, subscriptionPeriodEnd } from '@/lib/billing/stripe';
import { logger } from '@/lib/utils/logger';
import { loadPlans, planForPrice } from '@/lib/billing/plans';

/**
 * POST /api/stripe/webhook
 * Apply Hub Pro and ProDrive overage changes from Stripe.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'STRIPE_WEBHOOK_SECRET is not set' }, { status: 500 });
  }

  const stripe = getStripe();
  const signature = request.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'Missing signature' }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, secret);
  } catch (error) {
    logger.warn('Stripe webhook signature failed', { error: error instanceof Error ? error.message : 'unknown' });
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const service = createServiceRoleClient();

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;
      const kind = session.metadata?.product_kind;
      if (kind === 'invoice_payment') {
        const applied = await applyInvoiceCheckoutSession(service, session);
        if ('error' in applied) throw new Error(applied.error);
      }
      const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
      if (userId && subscriptionId && (kind === 'hub_pro' || kind === 'hub_plan' || kind === 'prodrive_overage')) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await applySubscription(service, userId, kind, subscription);
      }
    }

    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.user_id;
      const kind = subscription.metadata?.product_kind;
      if (userId && (kind === 'hub_pro' || kind === 'hub_plan' || kind === 'prodrive_overage')) {
        const ended = event.type === 'customer.subscription.deleted';
        await applySubscription(service, userId, kind, subscription, ended);
      }
    }
  } catch (error) {
    logger.error('Stripe webhook handler failed', { type: event.type }, error as Error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function applySubscription(
  service: ReturnType<typeof createServiceRoleClient>,
  userId: string,
  kind: string,
  subscription: Stripe.Subscription,
  ended = false
) {
  if (kind === 'hub_plan') {
    await applyPlanSubscription(service, userId, subscription, ended);
    return;
  }

  if (kind === 'hub_pro') {
    const active = !ended && (subscription.status === 'active' || subscription.status === 'trialing');
    const status = ended
      ? 'canceled'
      : subscription.status === 'trialing'
        ? 'trialing'
        : subscription.status === 'past_due'
          ? 'past_due'
          : subscription.status === 'incomplete'
            ? 'incomplete'
            : subscription.status === 'canceled'
              ? 'canceled'
              : 'active';
    await service.from('hub_subscriptions').upsert({
      user_id: userId,
      stripe_customer_id: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
      stripe_subscription_id: subscription.id,
      plan: active ? 'pro' : 'free',
      status,
      current_period_end: subscriptionPeriodEnd(subscription),
    });
    return;
  }

  const itemId = subscription.items.data[0]?.id ?? null;
  const enabled = !ended && (subscription.status === 'active' || subscription.status === 'trialing');
  await service.from('pro_drive_billing').upsert({
    user_id: userId,
    overage_enabled: enabled,
    overage_stripe_subscription_id: enabled ? subscription.id : null,
    overage_stripe_item_id: enabled ? itemId : null,
  });
}

/** Company plans: the price on the subscription decides the plan (so portal plan changes apply too). */
async function applyPlanSubscription(
  service: ReturnType<typeof createServiceRoleClient>,
  userId: string,
  subscription: Stripe.Subscription,
  ended: boolean
) {
  const plans = await loadPlans(service, true);
  const priceId = subscription.items.data[0]?.price?.id;
  const match = planForPrice(plans, priceId);
  const slug = match?.plan.slug ?? subscription.metadata?.plan ?? 'free';
  const interval = match?.interval ?? (subscription.items.data[0]?.price?.recurring?.interval === 'year' ? 'year' : 'month');
  const status = ended
    ? 'canceled'
    : subscription.status === 'trialing'
      ? 'trialing'
      : subscription.status === 'past_due' || subscription.status === 'unpaid'
        ? 'past_due'
        : subscription.status === 'incomplete' || subscription.status === 'incomplete_expired'
          ? 'incomplete'
          : subscription.status === 'canceled'
            ? 'canceled'
            : 'active';
  const granted = status === 'active' || status === 'trialing' || status === 'past_due';

  const { data: existing } = await service.from('hub_subscriptions').select('comped, plan').eq('user_id', userId).maybeSingle();
  // A plan the admin gave for free stays until the admin ends it.
  const keepComp = Boolean(existing?.comped);
  await service.from('hub_subscriptions').upsert({
    user_id: userId,
    stripe_customer_id: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
    stripe_subscription_id: subscription.id,
    plan: keepComp ? existing!.plan : granted ? slug : 'free',
    status: keepComp ? 'active' : status,
    billing_interval: interval,
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    current_period_end: subscriptionPeriodEnd(subscription),
  });
}
