import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/billing/stripe';
import { requireDriveUser } from '@/lib/drive/server';
import { driveErrorResponse } from '@/lib/drive/http';

const bodySchema = z.object({ locale: z.string().min(2).max(5) });

/**
 * POST /api/billing/portal { locale }
 * Opens the Stripe customer portal: card on file, invoices and receipts, cancel.
 */
export async function POST(request: NextRequest) {
  try {
    const { locale } = bodySchema.parse(await request.json());
    const { user } = await requireDriveUser();
    const { data: sub } = await createServiceRoleClient()
      .from('hub_subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!sub?.stripe_customer_id) return NextResponse.json({ error: 'No billing account yet.' }, { status: 400 });
    const session = await getStripe().billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${request.nextUrl.origin}/${locale}/subscription`,
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    return driveErrorResponse(error);
  }
}
