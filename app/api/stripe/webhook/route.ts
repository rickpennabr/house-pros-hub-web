import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getStripe, subscriptionPeriodEnd } from '@/lib/billing/stripe';
import { logger } from '@/lib/utils/logger';

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
      const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
      if (userId && subscriptionId && (kind === 'hub_pro' || kind === 'prodrive_overage')) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await applySubscription(service, userId, kind, subscription);
      }
    }

    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.user_id;
      const kind = subscription.metadata?.product_kind;
      if (userId && (kind === 'hub_pro' || kind === 'prodrive_overage')) {
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
