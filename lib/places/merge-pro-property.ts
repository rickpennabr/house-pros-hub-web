import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/supabase';
import { splitUnit } from '@/lib/address/unit';

type Admin = SupabaseClient<Database>;

/** Street words written either way ("West Ann Road" and "W Ann Rd" are the same street). */
const WORDS: Record<string, string> = {
  north: 'n',
  south: 's',
  east: 'e',
  west: 'w',
  northeast: 'ne',
  northwest: 'nw',
  southeast: 'se',
  southwest: 'sw',
  street: 'st',
  avenue: 'ave',
  av: 'ave',
  road: 'rd',
  drive: 'dr',
  lane: 'ln',
  boulevard: 'blvd',
  court: 'ct',
  circle: 'cir',
  place: 'pl',
  parkway: 'pkwy',
  highway: 'hwy',
  terrace: 'ter',
  trail: 'trl',
  way: 'way',
  square: 'sq',
  loop: 'loop',
};

function streetWords(value: string): string {
  return value
    .toLowerCase()
    .replace(/[.,]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => WORDS[word] ?? word)
    .join(' ');
}

/**
 * Compare two mailing lines: same street (abbreviations ignored) and the same unit, so two
 * apartments in one building stay apart.
 */
export function streetMatchKey(value: string | null | undefined): string {
  const { street, unit } = splitUnit(value ?? '');
  const unitKey = unit.toLowerCase().replace(/^(apt|apartment|unit|ste|suite|#)\s*#?\s*/, '').trim();
  const streetKey = streetWords(street);
  if (!streetKey) return '';
  return unitKey ? `${streetKey} #${unitKey}` : streetKey;
}

const zip5 = (value: string | null | undefined) => (value ?? '').trim().slice(0, 5);

/**
 * The customer linked one of their My Places houses to this pro's contact. Properties the pro had
 * added on the contact at the same address are the same house: move the pro's estimates,
 * invoices, maintenance agreements, projects and timeline onto the customer's house, then remove
 * the pro's copy. Returns how many pro properties were merged.
 */
export async function mergeMatchingProProperties(
  admin: Admin,
  params: { customerId: string; ownerId: string; placeId: string }
): Promise<number> {
  const { data: place } = await admin
    .from('customer_places')
    .select('id, user_id, street, zip_code')
    .eq('id', params.placeId)
    .maybeSingle();
  if (!place?.user_id) return 0;
  const key = streetMatchKey(place.street);
  if (!key) return 0;

  const { data: links } = await admin
    .from('pro_crm_customer_places')
    .select('place_id')
    .eq('customer_id', params.customerId)
    .eq('owner_id', params.ownerId);
  const linkedIds = (links ?? []).map((row) => row.place_id).filter((id) => id !== place.id);
  if (linkedIds.length === 0) return 0;

  const { data: candidates } = await admin
    .from('customer_places')
    .select('id, street, zip_code')
    .in('id', linkedIds)
    .is('user_id', null)
    .eq('owner_id', params.ownerId);
  const matches = (candidates ?? []).filter(
    (row) =>
      streetMatchKey(row.street) === key &&
      // A ZIP on both sides must agree; a missing one does not block the match.
      (!zip5(row.zip_code) || !zip5(place.zip_code) || zip5(row.zip_code) === zip5(place.zip_code))
  );

  let merged = 0;
  for (const match of matches) {
    const moves = await Promise.all([
      admin.from('pro_crm_estimates').update({ place_id: place.id }).eq('owner_id', params.ownerId).eq('place_id', match.id),
      admin.from('pro_crm_invoices').update({ place_id: place.id }).eq('owner_id', params.ownerId).eq('place_id', match.id),
      admin
        .from('pro_crm_maintenance_plans')
        .update({ place_id: place.id })
        .eq('owner_id', params.ownerId)
        .eq('place_id', match.id),
      admin.from('customer_place_events').update({ place_id: place.id }).eq('place_id', match.id),
    ]);
    const failed = moves.find((result) => result.error);
    if (failed?.error) {
      // Keep the pro's copy so nothing is lost; the records stay on it.
      console.error('mergeMatchingProProperties move', failed.error.message);
      continue;
    }
    // Projects name their property from migration 146 on; older databases have no column.
    const projects = await admin
      .from('pro_crm_projects')
      .update({ place_id: place.id })
      .eq('owner_id', params.ownerId)
      .eq('place_id', match.id);
    if (projects.error && !/place_id/.test(projects.error.message)) {
      console.error('mergeMatchingProProperties projects', projects.error.message);
      continue;
    }

    const { error: deleteError } = await admin.from('customer_places').delete().eq('id', match.id);
    if (deleteError) {
      console.error('mergeMatchingProProperties delete', deleteError.message);
      continue;
    }
    merged += 1;
  }
  return merged;
}
