import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not set');
  }
  if (!stripeClient) {
    stripeClient = new Stripe(key, { apiVersion: '2025-07-30.basil' });
  }
  return stripeClient;
}

export function hubProPriceId(): string | null {
  return process.env.STRIPE_HUB_PRO_PRICE_ID || null;
}

export function proDriveOveragePriceId(): string | null {
  return process.env.STRIPE_PRODRIVE_OVERAGE_PRICE_ID || null;
}

export function subscriptionPeriodEnd(subscription: Stripe.Subscription): string | null {
  const legacy = (subscription as Stripe.Subscription & { current_period_end?: number }).current_period_end;
  const itemEnd = subscription.items.data[0]
    ? (subscription.items.data[0] as Stripe.SubscriptionItem & { current_period_end?: number }).current_period_end
    : undefined;
  const unix = legacy ?? itemEnd;
  return unix ? new Date(unix * 1000).toISOString() : null;
}
