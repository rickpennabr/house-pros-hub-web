import type { CrmDb } from '@/lib/crm/crm-scope';

/** Lowercase, trimmed, single-spaced: two wordings that only differ in case are the same. */
export function lineKey(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export interface LineDescriptionInput {
  product_or_service?: unknown;
  description?: unknown;
  expense_id?: unknown;
}

/** The (item, description) pairs on a document worth remembering. Job-cost lines are skipped. */
export function descriptionsToRemember(lines: unknown): Array<{ item: string; description: string }> {
  if (!Array.isArray(lines)) return [];
  const seen = new Set<string>();
  const found: Array<{ item: string; description: string }> = [];
  for (const raw of lines as LineDescriptionInput[]) {
    if (!raw || typeof raw !== 'object' || raw.expense_id) continue;
    const item = typeof raw.product_or_service === 'string' ? raw.product_or_service.trim() : '';
    const description = typeof raw.description === 'string' ? raw.description.trim() : '';
    if (!item || !description || item.length > 200 || description.length > 2000) continue;
    const key = `${lineKey(item)}\n${lineKey(description)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    found.push({ item, description });
  }
  return found;
}

/**
 * Save the descriptions typed on an invoice or estimate so they are offered next time for the
 * same product or service. Best effort: before migration 168 there is no table and nothing happens.
 */
export async function rememberLineDescriptions(db: CrmDb, ownerId: string, lines: unknown): Promise<void> {
  const pairs = descriptionsToRemember(lines);
  if (pairs.length === 0) return;
  const now = new Date().toISOString();
  await db.from('pro_crm_line_descriptions').upsert(
    pairs.map(({ item, description }) => ({
      owner_id: ownerId,
      item_name: item,
      item_key: lineKey(item),
      description,
      description_key: lineKey(description),
      last_used_at: now,
    })),
    { onConflict: 'owner_id,item_key,description_key' }
  );
}
