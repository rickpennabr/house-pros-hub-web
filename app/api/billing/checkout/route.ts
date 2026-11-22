import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getStripe, subscriptionPeriodEnd } from '@/lib/billing/stripe';
import { loadPlans, subscriptionGrantsPlan, type HubSubscription } from '@/lib/billing/plans';
import { requireDriveUser } from '@/lib/drive/server';
import { driveErrorResponse } from '@/lib/drive/http';

const bodySchema = z.object({
  plan: z.string().regex(/^[a-z0-9-]{2,30}$/),
  interval: z.enum(['month', 'year']),
  locale: z.string().min(2).max(5),
});

/**
 * POST /api/billing/checkout { plan, interval, locale }
 * New subscribers go to Stripe Checkout. A company that already pays switches plan in place
 * (Stripe prorates the difference).
 */
export async function POST(request: NextRequest) {
  try {
    const { plan: slug, interval, locale } = bodySchema.parse(await request.json());
    const { user } = await requireDriveUser();
    const service = createServiceRoleClient();
    const plans = await loadPlans(service);
    const plan = plans.find((row) => row.slug === slug);
    if (!plan) return NextResponse.json({ error: 'That plan is not available.' }, { status: 400 });
    const priceId = interval === 'year' ? plan.stripe_yearly_price_id : plan.stripe_monthly_price_id;
    if (!priceId) return NextResponse.json({ error: 'That plan cannot be bought online yet.' }, { status: 400 });

    const stripe = getStripe();
    const { data: existingRow } = await service.from('hub_subscriptions').select('*').eq('user_id', user.id).maybeSingle();
    const existing = (existingRow ?? null) as HubSubscription | null;
    const metadata = { user_id: user.id, product_kind: 'hub_plan', plan: plan.slug, interval };

    // Already paying through Stripe: change the plan on the same subscription.
    if (existing?.stripe_subscription_id && !existing.comped && subscriptionGrantsPlan(existing)) {
      const current = await stripe.subscriptions.retrieve(existing.stripe_subscription_id);
      if (current.status !== 'canceled') {
        const itemId = current.items.data[0]?.id;
        if (!itemId) throw new Error('Subscription has no items');
        const updated = await stripe.subscriptions.update(current.id, {
          items: [{ id: itemId, price: priceId }],
          proration_behavior: 'create_prorations',
          cancel_at_period_end: false,
          metadata,
        });
        await service
          .from('hub_subscriptions')
          .update({
            plan: plan.slug,
            billing_interval: interval,
            cancel_at_period_end: false,
            current_period_end: subscriptionPeriodEnd(updated),
          })
          .eq('user_id', user.id);
        return NextResponse.json({ switched: true });
      }
    }

    let customerId = existing?.stripe_customer_id ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email ?? undefined, metadata: { user_id: user.id } });
      customerId = customer.id;
      await service.from('hub_subscriptions').upsert({
        user_id: user.id,
        stripe_customer_id: customerId,
        plan: existing?.plan ?? 'free',
        status: existing?.status ?? 'active',
      });
    }

    const origin = request.nextUrl.origin;
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${origin}/${locale}/subscription?status=success`,
      cancel_url: `${origin}/${locale}/subscription?status=cancel`,
      metadata,
      subscription_data: {
        metadata,
        ...(plan.trial_days > 0 && !existing?.stripe_subscription_id ? { trial_period_days: plan.trial_days } : {}),
      },
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    return driveErrorResponse(error);
  }
}
