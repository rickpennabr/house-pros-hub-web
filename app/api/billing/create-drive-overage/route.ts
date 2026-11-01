import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { DRIVE_OVERAGE_USD_PER_GB } from '@/lib/drive/quota';
import { driveErrorResponse } from '@/lib/drive/http';
import { requireDriveUser } from '@/lib/drive/server';
import { getStripe, proDriveOveragePriceId } from '@/lib/billing/stripe';

const bodySchema = z.object({ locale: z.string().min(2).max(5) });

/**
 * POST /api/billing/create-drive-overage
 * Start Checkout for metered ProDrive storage at $0.032/GB/month.
 */
export async function POST(request: NextRequest) {
  try {
    const priceId = proDriveOveragePriceId();
    if (!priceId) {
      return NextResponse.json(
        { error: 'ProDrive overage is not configured. Set STRIPE_PRODRIVE_OVERAGE_PRICE_ID.' },
        { status: 500 }
      );
    }
    const { locale } = bodySchema.parse(await request.json());
    const { user } = await requireDriveUser();
    const service = createServiceRoleClient();
    const { data: billing } = await service.from('pro_drive_billing').select('*').eq('user_id', user.id).maybeSingle();
    if (billing?.overage_enabled && billing.overage_stripe_subscription_id) {
      return NextResponse.json({ alreadyEnabled: true, rateUsdPerGb: DRIVE_OVERAGE_USD_PER_GB });
    }

    const stripe = getStripe();
    const { data: subscription } = await service.from('hub_subscriptions').select('stripe_customer_id').eq('user_id', user.id).maybeSingle();
    let customerId = subscription?.stripe_customer_id ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;
      await service.from('hub_subscriptions').upsert({
        user_id: user.id,
        stripe_customer_id: customerId,
        plan: 'free',
        status: 'active',
      });
    }

    const origin = request.nextUrl.origin;
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId }],
      success_url: `${origin}/${locale}/subscription?status=overage`,
      cancel_url: `${origin}/${locale}/subscription?status=cancel`,
      metadata: { user_id: user.id, product_kind: 'prodrive_overage' },
      subscription_data: { metadata: { user_id: user.id, product_kind: 'prodrive_overage' } },
    });

    return NextResponse.json({ url: session.url, rateUsdPerGb: DRIVE_OVERAGE_USD_PER_GB });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    return driveErrorResponse(error);
  }
}
