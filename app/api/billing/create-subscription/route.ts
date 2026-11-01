import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getStripe, hubProPriceId } from '@/lib/billing/stripe';
import { requireDriveUser } from '@/lib/drive/server';
import { driveErrorResponse } from '@/lib/drive/http';

const bodySchema = z.object({ locale: z.string().min(2).max(5) });

/**
 * POST /api/billing/create-subscription
 * Start Stripe Checkout for Hub Pro (1 GB included ProDrive).
 */
export async function POST(request: NextRequest) {
  try {
    const priceId = hubProPriceId();
    if (!priceId) {
      return NextResponse.json({ error: 'Hub Pro is not configured. Set STRIPE_HUB_PRO_PRICE_ID.' }, { status: 500 });
    }
    const { locale } = bodySchema.parse(await request.json());
    const { user } = await requireDriveUser();
    const stripe = getStripe();
    const service = createServiceRoleClient();

    const { data: existing } = await service.from('hub_subscriptions').select('*').eq('user_id', user.id).maybeSingle();
    let customerId = existing?.stripe_customer_id ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;
    }
    await service.from('hub_subscriptions').upsert({
      user_id: user.id,
      stripe_customer_id: customerId,
      plan: existing?.plan ?? 'free',
      status: existing?.status ?? 'active',
    });

    const origin = request.nextUrl.origin;
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/${locale}/subscription?status=success`,
      cancel_url: `${origin}/${locale}/subscription?status=cancel`,
      metadata: { user_id: user.id, product_kind: 'hub_pro' },
      subscription_data: { metadata: { user_id: user.id, product_kind: 'hub_pro' } },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    return driveErrorResponse(error);
  }
}
