/** ProTrades data access. Server only. */
import type { Database } from '@/lib/types/supabase';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { isTableMissing } from '@/lib/billing/plans';
import { TRADES, isTradeSlug, type TradeSlug } from '@/lib/protrades/trades';
import { userOwnsCrm } from '@/lib/crm/require-contractor';

type Service = ReturnType<typeof createServiceRoleClient>;
export type TradeCatalogItem = Database['public']['Tables']['trade_catalog_items']['Row'];

export class ProTradesError extends Error {
  constructor(message: string, public status = 400, public code?: string) {
    super(message);
  }
}

export const PROTRADES_NOT_READY = 'ProTrades is not set up yet (apply migration 151_protrades.sql).';

/**
 * Whose trades apply: the pro's own, or for a crew member, the company owner's (read only).
 */
export async function tradesOwnerFor(
  userId: string,
  service: Service = createServiceRoleClient()
): Promise<{ ownerId: string; isOwner: boolean }> {
  if (await userOwnsCrm(userId)) return { ownerId: userId, isOwner: true };
  // Table added in 138_maintenance_visits; cast until supabase.ts includes it.
  type CrewQuery = {
    select: (cols: string) => CrewQuery;
    eq: (col: string, value: string) => CrewQuery;
    limit: (n: number) => CrewQuery;
    maybeSingle: () => Promise<{ data: { owner_id?: string } | null }>;
  };
  const { data } = await (service as unknown as { from: (table: string) => CrewQuery })
    .from('business_crew_members')
    .select('owner_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  const ownerId = data?.owner_id;
  return ownerId ? { ownerId, isOwner: false } : { ownerId: userId, isOwner: true };
}

/** Trades the user has turned on. Before migration 151, Landscape stays on so maintenance keeps showing. */
export async function activeTrades(userId: string, service: Service = createServiceRoleClient()): Promise<TradeSlug[]> {
  const { data, error } = await service.from('pro_trade_activations').select('trade').eq('user_id', userId);
  if (error) {
    // Not set up yet: nothing is on, so a new pro sees the standard CRM menu.
    if (isTableMissing(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => row.trade).filter(isTradeSlug).filter((slug) => TRADES[slug].available);
}

/** Turn a trade on or off. All trades are free for now. Turning off keeps all data. */
export async function setTradeActive(
  userId: string,
  trade: TradeSlug,
  active: boolean,
  service: Service = createServiceRoleClient()
): Promise<TradeSlug[]> {
  if (active) {
    if (!TRADES[trade].available) throw new ProTradesError('This trade is coming soon.', 400, 'PROTRADES_COMING_SOON');
    // Every trade is free to turn on for now (plans no longer cap ProTrades).
    const { error } = await service.from('pro_trade_activations').upsert({ user_id: userId, trade });
    if (error) throw isTableMissing(error) ? new ProTradesError(PROTRADES_NOT_READY, 503) : new Error(error.message);
  } else {
    const { error } = await service.from('pro_trade_activations').delete().eq('user_id', userId).eq('trade', trade);
    if (error) throw isTableMissing(error) ? new ProTradesError(PROTRADES_NOT_READY, 503) : new Error(error.message);
  }
  return activeTrades(userId, service);
}

/** PostgREST filter: items of this trade, plus items another trade shares with it. */
function inTrade(trade: TradeSlug): string {
  return `trade.eq.${trade},also_trades.cs.{${trade}}`;
}

function alsoTradesMissing(error: { code?: string; message?: string } | null): boolean {
  return !!error && (error.code === '42703' || /also_trades/.test(error.message ?? ''));
}

export interface CatalogQuery {
  trade: TradeSlug;
  kind?: string;
  /** Hardscape: 'pavers' (manufacturer catalog) or 'rock-yard' (Star Nursery). Kept apart on purpose. */
  collection?: string;
  category?: string;
  q?: string;
  includeInactive?: boolean;
  page?: number;
  pageSize?: number;
}

/** Browse a trade's reference database, including items shared from another trade (rock yard in Landscape). */
export async function searchCatalog(
  input: CatalogQuery,
  service: Service = createServiceRoleClient()
): Promise<{ items: TradeCatalogItem[]; total: number; categories: string[] }> {
  try {
    return await searchCatalogWith(input, service, true);
  } catch (err) {
    // Before migration 156 there is no also_trades column: show the trade's own items.
    if (err instanceof SharedColumnMissing) return searchCatalogWith(input, service, false);
    // Before migration 176 there is no collection column: show everything.
    if (err instanceof CollectionColumnMissing) return searchCatalog({ ...input, collection: undefined }, service);
    throw err;
  }
}

class SharedColumnMissing extends Error {}
class CollectionColumnMissing extends Error {}

async function searchCatalogWith(
  input: CatalogQuery,
  service: Service,
  shared: boolean
): Promise<{ items: TradeCatalogItem[]; total: number; categories: string[] }> {
  const pageSize = Math.min(100, Math.max(1, input.pageSize ?? 48));
  const page = Math.max(1, input.page ?? 1);
  let query = service.from('trade_catalog_items').select('*', { count: 'exact' });
  query = shared ? query.or(inTrade(input.trade)) : query.eq('trade', input.trade);
  if (!input.includeInactive) query = query.eq('is_active', true);
  if (input.kind) query = query.eq('kind', input.kind);
  if (input.collection) query = query.eq('collection', input.collection);
  if (input.category) query = query.eq('category', input.category);
  const q = input.q?.trim().replace(/[%,()]/g, ' ').slice(0, 80);
  if (q) query = query.or(`name.ilike.%${q}%,brand.ilike.%${q}%,scientific_name.ilike.%${q}%,category.ilike.%${q}%`);
  const { data, error, count } = await query
    .order('kind', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
    .range((page - 1) * pageSize, page * pageSize - 1);
  if (error) {
    if (input.collection && /collection/.test(error.message ?? '')) throw new CollectionColumnMissing();
    if (shared && alsoTradesMissing(error)) throw new SharedColumnMissing();
    if (isTableMissing(error)) throw new ProTradesError(PROTRADES_NOT_READY, 503);
    throw new Error(error.message);
  }

  let categoryQuery = service.from('trade_catalog_items').select('category');
  categoryQuery = shared ? categoryQuery.or(inTrade(input.trade)) : categoryQuery.eq('trade', input.trade);
  if (!input.includeInactive) categoryQuery = categoryQuery.eq('is_active', true);
  if (input.kind) categoryQuery = categoryQuery.eq('kind', input.kind);
  if (input.collection) categoryQuery = categoryQuery.eq('collection', input.collection);
  const { data: cats } = await categoryQuery.limit(1000);
  const categories = [...new Set((cats ?? []).map((row) => row.category).filter((c): c is string => Boolean(c)))].sort();

  return { items: (data ?? []) as TradeCatalogItem[], total: count ?? 0, categories };
}

export function catalogSpecs(item: Pick<TradeCatalogItem, 'specs'>): { name: string; value: string }[] {
  if (!Array.isArray(item.specs)) return [];
  return (item.specs as unknown[])
    .map((row) => (row && typeof row === 'object' ? (row as Record<string, unknown>) : {}))
    .filter((row) => typeof row.name === 'string' && typeof row.value === 'string' && row.name && row.value)
    .map((row) => ({ name: String(row.name).slice(0, 80), value: String(row.value).slice(0, 200) }));
}
