/**
 * Company subscription plans (hub_plans) and the user's current plan. Server only.
 * The admin edits plans at /admin/subscriptions; syncPlanToStripe keeps Stripe in step.
 */
import type Stripe from 'stripe';
import type { Database } from '@/lib/types/supabase';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/billing/stripe';

export type HubPlan = Database['public']['Tables']['hub_plans']['Row'];
export type HubSubscription = Database['public']['Tables']['hub_subscriptions']['Row'];
export type BillingInterval = 'month' | 'year';

type Service = ReturnType<typeof createServiceRoleClient>;

/** Used before migration 150 is applied, and as the fallback when a plan row is missing. */
export const FREE_PLAN_FALLBACK: HubPlan = {
  slug: 'free',
  name: 'Free',
  tagline: '',
  monthly_price_cents: 0,
  yearly_price_cents: 0,
  included_users: 1,
  extra_user_price_cents: 0,
  storage_gb: 0.5,
  protrades_limit: 1,
  trial_days: 0,
  features: [],
  highlight: false,
  is_active: true,
  sort_order: 0,
  stripe_product_id: null,
  stripe_monthly_price_id: null,
  stripe_yearly_price_id: null,
  created_at: new Date(0).toISOString(),
  updated_at: new Date(0).toISOString(),
};

export function isTableMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === '42P01' || error.code === 'PGRST205' || /does not exist|Could not find the table/i.test(error.message ?? '');
}

export async function loadPlans(service: Service = createServiceRoleClient(), includeInactive = false): Promise<HubPlan[]> {
  let query = service.from('hub_plans').select('*').order('sort_order', { ascending: true });
  if (!includeInactive) query = query.eq('is_active', true);
  const { data, error } = await query;
  if (error) {
    if (isTableMissing(error)) return [FREE_PLAN_FALLBACK];
    throw new Error(error.message);
  }
  return (data ?? []) as HubPlan[];
}

/** A subscription that currently grants its plan (paid and in good standing, or comped and not expired). */
export function subscriptionGrantsPlan(sub: Pick<HubSubscription, 'status' | 'comped' | 'comped_until' | 'plan'> | null): boolean {
  if (!sub || sub.plan === 'free') return false;
  if (sub.comped) return !sub.comped_until || new Date(sub.comped_until).getTime() > Date.now();
  return sub.status === 'active' || sub.status === 'trialing' || sub.status === 'past_due';
}

/** The plan a user is on right now (Free when nothing paid or comped applies). */
export async function currentPlanForUser(
  userId: string,
  service: Service = createServiceRoleClient()
): Promise<{ plan: HubPlan; subscription: HubSubscription | null }> {
  const { data: sub } = await service.from('hub_subscriptions').select('*').eq('user_id', userId).maybeSingle();
  const subscription = (sub ?? null) as HubSubscription | null;
  const slug = subscriptionGrantsPlan(subscription) ? subscription!.plan : 'free';
  const plans = await loadPlans(service, true);
  const plan =
    plans.find((row) => row.slug === slug) ??
    // Before migration 150 only the legacy Pro plan (1 GB) exists.
    (slug === 'pro' ? { ...FREE_PLAN_FALLBACK, slug: 'pro', name: 'Pro', storage_gb: 1, protrades_limit: null } : null) ??
    plans.find((row) => row.slug === 'free') ??
    FREE_PLAN_FALLBACK;
  return { plan, subscription };
}

/** Find the plan a Stripe price belongs to. */
export function planForPrice(plans: HubPlan[], priceId: string | null | undefined): { plan: HubPlan; interval: BillingInterval } | null {
  if (!priceId) return null;
  for (const plan of plans) {
    if (plan.stripe_monthly_price_id === priceId) return { plan, interval: 'month' };
    if (plan.stripe_yearly_price_id === priceId) return { plan, interval: 'year' };
  }
  return null;
}

/** Monthly recurring revenue of one subscription, in cents. */
export function monthlyValueCents(plan: HubPlan | undefined, interval: BillingInterval | null): number {
  if (!plan) return 0;
  return interval === 'year' ? Math.round(plan.yearly_price_cents / 12) : plan.monthly_price_cents;
}

async function ensurePrice(
  stripe: Stripe,
  productId: string,
  existingId: string | null,
  amountCents: number,
  interval: BillingInterval,
  slug: string
): Promise<string | null> {
  if (amountCents <= 0) {
    if (existingId) await stripe.prices.update(existingId, { active: false }).catch(() => undefined);
    return null;
  }
  if (existingId) {
    const existing = await stripe.prices.retrieve(existingId).catch(() => null);
    if (existing && existing.active && existing.unit_amount === amountCents && existing.recurring?.interval === interval) {
      return existingId;
    }
    // Stripe prices cannot change. Archive the old one; current subscribers keep it until they switch.
    if (existing?.active) await stripe.prices.update(existingId, { active: false }).catch(() => undefined);
  }
  const price = await stripe.prices.create({
    product: productId,
    currency: 'usd',
    unit_amount: amountCents,
    recurring: { interval },
    lookup_key: `hub_${slug}_${interval}`,
    transfer_lookup_key: true,
    metadata: { plan: slug, interval },
  });
  return price.id;
}

/**
 * Create or update the plan's Stripe product and prices, then save the IDs on the plan.
 * Free plans (both prices 0) need no Stripe objects.
 */
export async function syncPlanToStripe(plan: HubPlan, service: Service = createServiceRoleClient()): Promise<HubPlan> {
  if (plan.monthly_price_cents <= 0 && plan.yearly_price_cents <= 0 && !plan.stripe_product_id) return plan;
  const stripe = getStripe();
  let productId = plan.stripe_product_id;
  const productFields = {
    name: `House Pros Hub ${plan.name}`,
    description: plan.tagline || undefined,
    active: plan.is_active,
    metadata: { plan: plan.slug },
  };
  if (productId) {
    await stripe.products.update(productId, productFields);
  } else {
    const product = await stripe.products.create(productFields);
    productId = product.id;
  }
  const monthly = await ensurePrice(stripe, productId, plan.stripe_monthly_price_id, plan.monthly_price_cents, 'month', plan.slug);
  const yearly = await ensurePrice(stripe, productId, plan.stripe_yearly_price_id, plan.yearly_price_cents, 'year', plan.slug);
  const { data, error } = await service
    .from('hub_plans')
    .update({ stripe_product_id: productId, stripe_monthly_price_id: monthly, stripe_yearly_price_id: yearly })
    .eq('slug', plan.slug)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as HubPlan;
}
