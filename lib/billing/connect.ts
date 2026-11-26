/**
 * Stripe Connect (Express, destination charges): each business, or the owner's default (no business),
 * connects its own Stripe account. Invoice card payments go to that account. Server only.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';
import type { Database } from '@/lib/types/supabase';
import { getStripe } from '@/lib/billing/stripe';

type Client = SupabaseClient<Database>;
export type ConnectRow = Database['public']['Tables']['stripe_connect_accounts']['Row'];

/** The Hub's cut in basis points (100 = 1%). Default 0: pros keep everything but Stripe's fee. */
export function platformFeeCents(amountCents: number, bps = Number(process.env.STRIPE_CONNECT_FEE_BPS ?? 0)): number {
  if (!Number.isFinite(bps) || bps <= 0) return 0;
  return Math.min(amountCents, Math.floor((amountCents * Math.min(bps, 10_000)) / 10_000));
}

/** The business's own account first, then the owner's default. */
export function pickConnectAccount(rows: ConnectRow[], businessId: string | null): ConnectRow | null {
  const own = businessId ? rows.find((row) => row.business_id === businessId) : undefined;
  return own ?? rows.find((row) => row.business_id === null) ?? null;
}

async function ownerRows(service: Client, ownerId: string): Promise<ConnectRow[]> {
  const { data, error } = await service.from('stripe_connect_accounts').select('*').eq('owner_id', ownerId);
  if (error) return []; // Before migration 185.
  return (data ?? []) as ConnectRow[];
}

/** The account that takes card payments for this invoice, or null when none is ready. */
export async function connectAccountFor(service: Client, ownerId: string, businessId: string | null): Promise<ConnectRow | null> {
  const row = pickConnectAccount(await ownerRows(service, ownerId), businessId);
  return row?.charges_enabled ? row : null;
}

/** For many invoices at once: "ownerId|businessId" -> can take cards. */
export async function cardReadyFor(service: Client, invoices: { owner_id: string; business_id: string | null }[]): Promise<Set<string>> {
  const owners = [...new Set(invoices.map((invoice) => invoice.owner_id))];
  const ready = new Set<string>();
  if (owners.length === 0) return ready;
  const { data, error } = await service.from('stripe_connect_accounts').select('*').in('owner_id', owners);
  if (error) return ready;
  const rows = (data ?? []) as ConnectRow[];
  for (const invoice of invoices) {
    const row = pickConnectAccount(rows.filter((item) => item.owner_id === invoice.owner_id), invoice.business_id);
    if (row?.charges_enabled) ready.add(`${invoice.owner_id}|${invoice.business_id ?? ''}`);
  }
  return ready;
}

/** The row for exactly this business (or the default when businessId is null). */
export async function connectRowExact(service: Client, ownerId: string, businessId: string | null): Promise<ConnectRow | null> {
  return (await ownerRows(service, ownerId)).find((row) => row.business_id === businessId) ?? null;
}

export async function syncConnectAccount(service: Client, account: Stripe.Account): Promise<void> {
  await service
    .from('stripe_connect_accounts')
    .update({
      charges_enabled: Boolean(account.charges_enabled),
      payouts_enabled: Boolean(account.payouts_enabled),
      details_submitted: Boolean(account.details_submitted),
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_account_id', account.id);
}

/** Stripe-hosted onboarding link; creates the Express account the first time. */
export async function createOnboardingLink(
  service: Client,
  input: { ownerId: string; businessId: string | null; email?: string | null; returnUrl: string; refreshUrl: string }
): Promise<string> {
  const stripe = getStripe();
  let row = await connectRowExact(service, input.ownerId, input.businessId);
  if (!row) {
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'US',
      ...(input.email ? { email: input.email } : {}),
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      metadata: { owner_id: input.ownerId, business_id: input.businessId ?? '' },
    });
    const { data, error } = await service
      .from('stripe_connect_accounts')
      .insert({ owner_id: input.ownerId, business_id: input.businessId, stripe_account_id: account.id })
      .select('*')
      .single();
    if (error || !data) throw new Error(error?.message || 'Could not save the Stripe account');
    row = data as ConnectRow;
  }
  const link = await stripe.accountLinks.create({
    account: row.stripe_account_id,
    type: 'account_onboarding',
    return_url: input.returnUrl,
    refresh_url: input.refreshUrl,
  });
  return link.url;
}
