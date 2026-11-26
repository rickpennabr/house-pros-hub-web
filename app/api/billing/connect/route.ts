import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireContractor } from '@/lib/crm/require-contractor';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/billing/stripe';
import { connectRowExact, createOnboardingLink, syncConnectAccount } from '@/lib/billing/connect';

/** The caller's businesses (id + name). */
async function ownedBusinesses(ownerId: string) {
  const { data } = await createServiceRoleClient()
    .from('businesses')
    .select('id, business_name')
    .eq('owner_id', ownerId)
    .eq('is_active', true)
    .order('business_name');
  return (data ?? []) as { id: string; business_name: string | null }[];
}

/**
 * GET /api/billing/connect
 * Card-payment status for the default account and each of the pro's businesses.
 * Refreshes from Stripe (the pro may have just come back from onboarding).
 */
export async function GET() {
  try {
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError;
    const service = createServiceRoleClient();
    const businesses = await ownedBusinesses(user.id);
    const { data: rows, error } = await service.from('stripe_connect_accounts').select('*').eq('owner_id', user.id);
    if (error) return NextResponse.json({ ready: false, accounts: [] });
    const stripe = getStripe();
    for (const row of rows ?? []) {
      if (row.charges_enabled && row.payouts_enabled) continue;
      const account = await stripe.accounts.retrieve(row.stripe_account_id).catch(() => null);
      if (account) {
        await syncConnectAccount(service, account);
        row.charges_enabled = Boolean(account.charges_enabled);
        row.payouts_enabled = Boolean(account.payouts_enabled);
        row.details_submitted = Boolean(account.details_submitted);
      }
    }
    const status = (businessId: string | null) => {
      const row = (rows ?? []).find((item) => item.business_id === businessId);
      return {
        connected: Boolean(row),
        chargesEnabled: Boolean(row?.charges_enabled),
        payoutsEnabled: Boolean(row?.payouts_enabled),
      };
    };
    return NextResponse.json({
      ready: true,
      accounts: [
        { businessId: null, name: null, ...status(null) },
        ...businesses.map((business) => ({ businessId: business.id, name: business.business_name, ...status(business.id) })),
      ],
    });
  } catch (err) {
    console.error('GET /api/billing/connect', err);
    return NextResponse.json({ error: 'Could not load card payments' }, { status: 500 });
  }
}

const bodySchema = z.object({
  action: z.enum(['onboard', 'dashboard']),
  businessId: z.string().uuid().nullable().optional(),
  locale: z.string().min(2).max(5).optional(),
});

/**
 * POST /api/billing/connect { action: 'onboard' | 'dashboard', businessId? }
 * onboard: Stripe-hosted setup (identity, bank). dashboard: the pro's Stripe Express dashboard (payouts).
 */
export async function POST(request: NextRequest) {
  try {
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError;
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    const businessId = parsed.data.businessId ?? null;
    if (businessId && !(await ownedBusinesses(user.id)).some((business) => business.id === businessId)) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }
    const service = createServiceRoleClient();

    if (parsed.data.action === 'dashboard') {
      const row = await connectRowExact(service, user.id, businessId);
      if (!row?.details_submitted) return NextResponse.json({ error: 'Finish the Stripe setup first' }, { status: 400 });
      const link = await getStripe().accounts.createLoginLink(row.stripe_account_id);
      return NextResponse.json({ url: link.url });
    }

    const locale = parsed.data.locale || 'en';
    const back = `${request.nextUrl.origin}/${locale}/crm/invoice-settings`;
    const url = await createOnboardingLink(service, {
      ownerId: user.id,
      businessId,
      email: user.email,
      returnUrl: `${back}?connect=done`,
      refreshUrl: `${back}?connect=retry`,
    });
    return NextResponse.json({ url });
  } catch (err) {
    console.error('POST /api/billing/connect', err);
    const message = err instanceof Error ? err.message : 'Could not open Stripe';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
