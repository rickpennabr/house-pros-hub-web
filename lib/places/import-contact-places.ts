import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/supabase';
import { CONTACT_ADDRESS_NAME } from '@/lib/places/contact-address';
import { autoNickname } from '@/lib/places/auto-nickname';
import { addProProperty, linkContactPlace, type ProPropertyInput } from '@/lib/places/contact-places';
import { sameAddress } from '@/lib/places/merge-pro-property';
import { recordPlaceEntered, recordProLinked } from '@/lib/places/timeline';

/**
 * A pro can work with a customer in the CRM long before the customer signs up. Once the
 * customer's confirmed email claims the contact, the contact's properties go on the customer's
 * My Places, with every estimate, invoice, agreement, project and file on them:
 *   - the contact's billing address becomes one of the customer's houses (the default);
 *   - each property the pro added becomes the customer's (same id, so records stay on it);
 *   - a property at the address of a house the customer already has merges into that house.
 * It runs once per contact (places_imported_at), so a house the customer deletes stays deleted.
 * From then on, properties the pro adds go straight onto the customer's My Places.
 */

type Admin = SupabaseClient<Database>;
type PlaceRow = { id: string; street: string | null; zip_code: string | null };

const CONTACT_COLUMNS =
  'id, owner_id, place_id, portal_user_id, portal_kind, address_nickname, street_address, apartment, city, state, zip_code, billing_address_street_1, billing_address_street_2, billing_address_city, billing_address_state, billing_address_zip_code';

async function customerPlaces(admin: Admin, userId: string): Promise<PlaceRow[]> {
  const { data } = await admin.from('customer_places').select('id, street, zip_code').eq('user_id', userId);
  return data ?? [];
}

/** The customer's house at this address, or a new one on their My Places. */
async function customerHouseFor(
  admin: Admin,
  userId: string,
  input: ProPropertyInput
): Promise<{ id: string; created: boolean }> {
  const match = (await customerPlaces(admin, userId)).find((place) =>
    sameAddress(place, { street: input.street, zip_code: input.zipCode })
  );
  if (match) return { id: match.id, created: false };
  const { data, error } = await admin
    .from('customer_places')
    .insert({
      user_id: userId,
      owner_id: null,
      name: input.name,
      kind: input.kind,
      street: input.street,
      city: input.city,
      state: input.state,
      zip_code: input.zipCode,
    })
    .select('id')
    .single();
  if (error || !data) throw new Error(error?.message || 'Could not add the house');
  await recordPlaceEntered(data.id, input.name);
  return { id: data.id, created: true };
}

async function link(admin: Admin, contact: { id: string; owner_id: string }, placeId: string): Promise<void> {
  if (await linkContactPlace(admin, { customerId: contact.id, ownerId: contact.owner_id, placeId })) {
    await recordProLinked({ placeId, customerId: contact.id, ownerId: contact.owner_id });
  }
}

/** Put one claimed contact's properties on the customer's My Places. Returns false when it did not run. */
export async function importContactPlaces(admin: Admin, customerId: string): Promise<boolean> {
  const { data: contact } = await admin.from('pro_crm_customers').select(CONTACT_COLUMNS).eq('id', customerId).maybeSingle();
  if (!contact?.portal_user_id) return false;
  const userId = contact.portal_user_id;

  // 1. The billing address first: it becomes the default, so records with no property stay on it.
  const street = (contact.street_address || contact.billing_address_street_1 || '').trim();
  if (!contact.place_id && street) {
    const unit = (contact.street_address ? contact.apartment : contact.billing_address_street_2)?.trim();
    const kind = contact.portal_kind ?? 'house';
    const house = await customerHouseFor(admin, userId, {
      name: (contact.address_nickname?.trim() || autoNickname(street, kind) || CONTACT_ADDRESS_NAME).slice(0, 120),
      kind,
      street: unit ? `${street}, ${unit}` : street,
      city: contact.city || contact.billing_address_city,
      state: contact.state || contact.billing_address_state,
      zipCode: contact.zip_code || contact.billing_address_zip_code,
    });
    await link(admin, contact, house.id);
  }

  // 2. The properties the pro added (any left after step 1 merged one at the same address).
  const { data: links } = await admin
    .from('pro_crm_customer_places')
    .select('place_id, created_at')
    .eq('customer_id', contact.id)
    .order('created_at', { ascending: true });
  const linkedIds = (links ?? []).map((row) => row.place_id);
  const { data: proPlaces } = linkedIds.length
    ? await admin
        .from('customer_places')
        .select('id, name, street, zip_code')
        .in('id', linkedIds)
        .is('user_id', null)
        .eq('owner_id', contact.owner_id)
    : { data: [] as Array<PlaceRow & { name: string }> };
  for (const id of linkedIds) {
    const proPlace = (proPlaces ?? []).find((row) => row.id === id);
    if (!proPlace) continue;
    const match = (await customerPlaces(admin, userId)).find((place) => sameAddress(place, proPlace));
    if (match) {
      // Linking the customer's house merges the pro's copy at that address into it.
      await link(admin, contact, match.id);
      continue;
    }
    const { error } = await admin
      .from('customer_places')
      .update({ user_id: userId, owner_id: null })
      .eq('id', proPlace.id)
      .is('user_id', null);
    if (error) {
      console.error('importContactPlaces adopt', error.message);
      continue;
    }
    await recordPlaceEntered(proPlace.id, proPlace.name);
    await link(admin, contact, proPlace.id);
  }

  const { error } = await admin
    .from('pro_crm_customers')
    .update({ places_imported_at: new Date().toISOString() })
    .eq('id', contact.id);
  if (error) throw new Error(error.message);
  return true;
}

/** Import every contact claimed by this customer that has not been imported yet. */
export async function importClaimedContactPlaces(admin: Admin, userId: string): Promise<void> {
  const { data: contacts, error } = await admin
    .from('pro_crm_customers')
    .select('id')
    .eq('portal_user_id', userId)
    .is('places_imported_at', null);
  if (error) {
    // Before migration 148 there is no places_imported_at: skip rather than import again and again.
    console.error('importClaimedContactPlaces', error.message);
    return;
  }
  for (const row of contacts ?? []) {
    try {
      await importContactPlaces(admin, row.id);
    } catch (importError) {
      console.error('importContactPlaces', row.id, importError);
    }
  }
}

/**
 * The pro adds a property on the contact. When the customer has an account (and their places
 * were imported), it goes on their My Places (or links their house at that address); otherwise it
 * stays the pro's own record until the customer signs up.
 */
export async function addContactProperty(
  admin: Admin,
  params: { customerId: string; ownerId: string; input: ProPropertyInput }
): Promise<string> {
  const { data: contact } = await admin
    .from('pro_crm_customers')
    .select('id, owner_id, portal_user_id, places_imported_at')
    .eq('id', params.customerId)
    .eq('owner_id', params.ownerId)
    .maybeSingle();
  if (!contact?.portal_user_id || !contact.places_imported_at) return addProProperty(admin, params);
  const house = await customerHouseFor(admin, contact.portal_user_id, params.input);
  await link(admin, contact, house.id);
  return house.id;
}
