/** Read and save a business's trades. Server only. Safe before migration 155 (columns missing → no trades). */
import { createServiceRoleClient } from '@/lib/supabase/server';
import { cleanTradeSlugs, isHouseTradeSlug } from '@/lib/pros/house-trades';

type Service = ReturnType<typeof createServiceRoleClient>;

export interface BusinessTrades {
  primaryTrade: string | null;
  trades: string[];
}

function columnMissing(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === '42703' || error.code === 'PGRST204' || /primary_trade|trades/.test(error.message ?? '');
}

/** Trades for many businesses at once, keyed by business id. */
export async function loadBusinessTrades(ids: string[], service: Service = createServiceRoleClient()): Promise<Map<string, BusinessTrades>> {
  const map = new Map<string, BusinessTrades>();
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return map;
  const { data, error } = await service.from('businesses').select('id, primary_trade, trades').in('id', unique);
  if (error) {
    if (!columnMissing(error)) console.error('loadBusinessTrades:', error.message);
    return map;
  }
  for (const row of data ?? []) {
    map.set(row.id, {
      primaryTrade: isHouseTradeSlug(row.primary_trade) ? row.primary_trade : null,
      trades: cleanTradeSlugs(row.trades),
    });
  }
  return map;
}

/** Pull trade fields from a row selected with `*` (undefined before migration 155). */
export function tradesFromRow(row: unknown): BusinessTrades {
  const record = (row ?? {}) as { primary_trade?: unknown; trades?: unknown };
  return {
    primaryTrade: isHouseTradeSlug(record.primary_trade) ? record.primary_trade : null,
    trades: cleanTradeSlugs(record.trades),
  };
}

/**
 * Save trades on a business. Unknown slugs are dropped. Returns false when the columns aren't there yet
 * (migration 155 not applied) so callers can carry on.
 */
export async function saveBusinessTrades(
  businessId: string,
  input: { primaryTrade?: unknown; trades?: unknown },
  service: Service = createServiceRoleClient()
): Promise<boolean> {
  const update: { primary_trade?: string | null; trades?: string[] } = {};
  if (input.primaryTrade !== undefined) update.primary_trade = isHouseTradeSlug(input.primaryTrade) ? input.primaryTrade : null;
  if (input.trades !== undefined) update.trades = cleanTradeSlugs(input.trades);
  if (Object.keys(update).length === 0) return true;
  const { error } = await service.from('businesses').update(update).eq('id', businessId);
  if (error) {
    if (!columnMissing(error)) console.error('saveBusinessTrades:', error.message);
    return false;
  }
  return true;
}
