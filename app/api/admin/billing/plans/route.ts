import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/blog/admin';
import { isTableMissing, loadPlans, syncPlanToStripe, type HubPlan } from '@/lib/billing/plans';

const cents = z.number().int().min(0).max(10_000_000);

const planSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{2,30}$/, 'Use 2–30 lowercase letters, numbers or dashes'),
  name: z.string().trim().min(1).max(60),
  tagline: z.string().trim().max(160).default(''),
  monthly_price_cents: cents,
  yearly_price_cents: cents,
  included_users: z.number().int().min(1).max(10000).nullable(),
  extra_user_price_cents: cents.default(0),
  storage_gb: z.number().min(0).max(100000),
  protrades_limit: z.number().int().min(0).max(100).nullable(),
  trial_days: z.number().int().min(0).max(90).default(0),
  features: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
  highlight: z.boolean().default(false),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().min(0).max(1000).default(0),
});

/** GET /api/admin/billing/plans: every plan, active or not. Admin only. */
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;
  try {
    const plans = await loadPlans(createServiceRoleClient(), true);
    return NextResponse.json({ plans, stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not load plans' }, { status: 500 });
  }
}

/** POST /api/admin/billing/plans: create or update a plan, then sync it to Stripe. Admin only. */
export async function POST(request: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;
  const parsed = planSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid plan' }, { status: 400 });
  }
  const service = createServiceRoleClient();
  const { data, error: saveError } = await service.from('hub_plans').upsert(parsed.data).select('*').single();
  if (saveError) {
    const message = isTableMissing(saveError) ? 'Apply migration 150_hub_plans.sql first.' : saveError.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }
  let plan = data as HubPlan;
  let stripeError: string | null = null;
  if (process.env.STRIPE_SECRET_KEY) {
    try {
      plan = await syncPlanToStripe(plan, service);
    } catch (err) {
      stripeError = err instanceof Error ? err.message : 'Stripe sync failed';
      console.error('Plan Stripe sync failed', stripeError);
    }
  } else {
    stripeError = 'STRIPE_SECRET_KEY is not set, so the plan was saved without Stripe prices.';
  }
  return NextResponse.json({ plan, stripeError });
}
