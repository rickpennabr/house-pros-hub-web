import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/supabase';
import { createServiceRoleClient } from '@/lib/supabase/server';

/**
 * A pro's CRM contact is one person. The customer links any of their My Places to it (sharing
 * the place in a chat, or approving the pro in My Places). The contact's place_id is the default
 * property; each estimate and invoice may name another of the linked ones in its own place_id.
 */

type Admin = SupabaseClient<Database>;

export interface PlacedContact {
  id: string;
  owner_id: string;
  place_id: string | null;
}

export interface ContactProperty {
  id: string;
  name: string;
  kind: 'house' | 'business' | 'building';
  street: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  isDefault: boolean;
  /** The pro added it on the contact (not one of the customer's My Places). The pro may edit it. */
  addedByPro: boolean;
  /**
   * The contact's own (billing) address, edited on the contact form. Its id is '' because it is
   * not a place row: documents on it have place_id NULL.
   */
  isContactAddress?: boolean;
}

import { CONTACT_ADDRESS_NAME } from '@/lib/places/contact-address';

/**
 * The contact's properties: the customer's My Places they shared or approved, and the ones the
 * pro added. The default comes first: the contact's place_id, else the first one linked. An
 * estimate, invoice or agreement with no place_id is on that default.
 */
export async function listContactProperties(admin: Admin, customerId: string): Promise<ContactProperty[]> {
  const [{ data: contact }, { data: links }] = await Promise.all([
    admin
      .from('pro_crm_customers')
      .select(
        'owner_id, place_id, portal_user_id, portal_kind, address_nickname, street_address, apartment, city, state, zip_code, billing_address_street_1, billing_address_street_2, billing_address_city, billing_address_state, billing_address_zip_code'
      )
      .eq('id', customerId)
      .maybeSingle(),
    admin
      .from('pro_crm_customer_places')
      .select('place_id, created_at')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: true }),
  ]);
  if (!contact) return [];
  const ids = [...new Set([contact.place_id, ...(links ?? []).map((row) => row.place_id)].filter(Boolean))] as string[];
  const { data: places } = ids.length
    ? await admin.from('customer_places').select('id, user_id, owner_id, name, kind, street, city, state, zip_code').in('id', ids)
    : { data: [] };
  // The customer's own places count only while this contact is linked to that customer.
  const allowed = (place: { user_id: string | null; owner_id: string | null }) =>
    place.user_id ? place.user_id === contact.portal_user_id : place.owner_id === contact.owner_id;
  const linked: ContactProperty[] = ids
    .map((id) => (places ?? []).find((place) => place.id === id))
    .filter((place): place is NonNullable<typeof place> => Boolean(place) && allowed(place!))
    .map((place) => ({
      id: place.id,
      name: place.name,
      kind: place.kind,
      street: place.street,
      city: place.city,
      state: place.state,
      zipCode: place.zip_code,
      isDefault: false,
      addedByPro: !place.user_id,
    }));

  // Without a My Places default, the contact's own address is the default property (place_id NULL).
  const street = (contact.street_address || contact.billing_address_street_1 || '').trim();
  const unit = (contact.street_address ? contact.apartment : contact.billing_address_street_2)?.trim();
  const own: ContactProperty[] =
    !contact.place_id && (street || contact.address_nickname?.trim())
      ? [
          {
            id: '',
            name: contact.address_nickname?.trim() || CONTACT_ADDRESS_NAME,
            kind: contact.portal_kind ?? 'house',
            street: [street, unit].filter(Boolean).join(', ') || null,
            city: contact.city || contact.billing_address_city,
            state: contact.state || contact.billing_address_state,
            zipCode: contact.zip_code || contact.billing_address_zip_code,
            isDefault: false,
            addedByPro: true,
            isContactAddress: true,
          },
        ]
      : [];
  return [...own, ...linked].map((property, index) => ({ ...property, isDefault: index === 0 }));
}

export interface ProPropertyInput {
  name: string;
  kind: ContactProperty['kind'];
  street: string;
  city: string | null;
  state: string | null;
  zipCode: string | null;
}

/** Add a property to the pro's contact. It is the pro's record only; it never shows on My Places. */
export async function addProProperty(
  admin: Admin,
  params: { customerId: string; ownerId: string; input: ProPropertyInput }
): Promise<string> {
  const { input } = params;
  const { data: place, error } = await admin
    .from('customer_places')
    .insert({
      user_id: null,
      owner_id: params.ownerId,
      name: input.name,
      kind: input.kind,
      street: input.street,
      city: input.city,
      state: input.state,
      zip_code: input.zipCode,
    })
    .select('id')
    .single();
  if (error || !place) throw new Error(error?.message || 'Could not add the property');
  const { error: linkError } = await admin
    .from('pro_crm_customer_places')
    .insert({ owner_id: params.ownerId, customer_id: params.customerId, place_id: place.id });
  if (linkError) {
    await admin.from('customer_places').delete().eq('id', place.id);
    throw new Error(linkError.message);
  }
  return place.id;
}

/** A property this pro added to this contact, or null (customer-owned places are read-only). */
async function ownedProProperty(admin: Admin, params: { customerId: string; ownerId: string; placeId: string }) {
  const { data: link } = await admin
    .from('pro_crm_customer_places')
    .select('id')
    .eq('customer_id', params.customerId)
    .eq('owner_id', params.ownerId)
    .eq('place_id', params.placeId)
    .maybeSingle();
  if (!link) return null;
  const { data: place } = await admin
    .from('customer_places')
    .select('id')
    .eq('id', params.placeId)
    .is('user_id', null)
    .eq('owner_id', params.ownerId)
    .maybeSingle();
  return place;
}

export async function updateProProperty(
  admin: Admin,
  params: { customerId: string; ownerId: string; placeId: string; input: ProPropertyInput }
): Promise<boolean> {
  if (!(await ownedProProperty(admin, params))) return false;
  const { input } = params;
  const { error } = await admin
    .from('customer_places')
    .update({
      name: input.name,
      kind: input.kind,
      street: input.street,
      city: input.city,
      state: input.state,
      zip_code: input.zipCode,
    })
    .eq('id', params.placeId);
  if (error) throw new Error(error.message);
  return true;
}

/** Remove a property the pro added. Estimates, invoices and agreements on it move to the default. */
export async function removeProProperty(
  admin: Admin,
  params: { customerId: string; ownerId: string; placeId: string }
): Promise<boolean> {
  if (!(await ownedProProperty(admin, params))) return false;
  const { error } = await admin.from('customer_places').delete().eq('id', params.placeId);
  if (error) throw new Error(error.message);
  return true;
}

/** Is this place one of the contact's linked properties? */
export async function contactHasPlace(admin: Admin, customerId: string, placeId: string): Promise<boolean> {
  if (!placeId) return false;
  const properties = await listContactProperties(admin, customerId);
  return properties.some((property) => property.id === placeId);
}

/**
 * Link one of the customer's places to the contact. The first one becomes the default, and a
 * blank contact address is filled from it. Only call this after the customer chose the place.
 * Returns true when the place is new for this contact.
 */
export async function linkContactPlace(
  admin: Admin,
  params: { customerId: string; ownerId: string; placeId: string }
): Promise<boolean> {
  const { data: contact } = await admin
    .from('pro_crm_customers')
    .select('id, owner_id, place_id, portal_user_id, street_address')
    .eq('id', params.customerId)
    .eq('owner_id', params.ownerId)
    .maybeSingle();
  if (!contact?.portal_user_id) return false;
  const { data: place } = await admin
    .from('customer_places')
    .select('id, kind, street, city, state, zip_code')
    .eq('id', params.placeId)
    .eq('user_id', contact.portal_user_id)
    .maybeSingle();
  if (!place?.street?.trim()) return false;

  const { data: existing } = await admin
    .from('pro_crm_customer_places')
    .select('id')
    .eq('customer_id', contact.id)
    .eq('place_id', place.id)
    .maybeSingle();
  if (!existing) {
    const { error } = await admin
      .from('pro_crm_customer_places')
      .upsert(
        { owner_id: contact.owner_id, customer_id: contact.id, place_id: place.id },
        { onConflict: 'customer_id,place_id', ignoreDuplicates: true }
      );
    if (error) throw new Error(error.message);
  }

  const patch: Database['public']['Tables']['pro_crm_customers']['Update'] = {};
  if (!contact.place_id) {
    patch.place_id = place.id;
    patch.portal_kind = place.kind;
  }
  if (!contact.street_address?.trim()) {
    patch.street_address = place.street;
    patch.city = place.city;
    patch.state = place.state;
    patch.zip_code = place.zip_code;
  }
  if (Object.keys(patch).length > 0) {
    const { error } = await admin.from('pro_crm_customers').update(patch).eq('id', contact.id);
    if (error) throw new Error(error.message);
  }
  return !existing && contact.place_id !== place.id;
}

/** This person's contacts (any pro) that have the place: as their default or as a linked property. */
export async function contactsOnPlace(admin: Admin, userId: string, placeId: string): Promise<PlacedContact[]> {
  const { data: links } = await admin.from('pro_crm_customer_places').select('customer_id').eq('place_id', placeId);
  const linkedIds = [...new Set((links ?? []).map((row) => row.customer_id))];
  let query = admin.from('pro_crm_customers').select('id, owner_id, place_id').eq('portal_user_id', userId);
  query = linkedIds.length
    ? query.or(`place_id.eq.${placeId},id.in.(${linkedIds.join(',')})`)
    : query.eq('place_id', placeId);
  const { data } = await query;
  return data ?? [];
}

/**
 * Is this estimate or invoice for the place? Its own property when set, else the contact's
 * default. The contact must be one of contactsOnPlace for this place.
 */
export function docIsOnPlace(
  doc: { customer_id: string; place_id?: string | null },
  placeId: string,
  contacts: PlacedContact[]
): boolean {
  const contact = contacts.find((row) => row.id === doc.customer_id);
  if (!contact) return false;
  return doc.place_id ? doc.place_id === placeId : contact.place_id === placeId;
}

/** Projects, maintenance and files have no property of their own yet: they go on the default. */
export function contactDefaultIsPlace(customerId: string, placeId: string, contacts: PlacedContact[]): boolean {
  return contacts.some((row) => row.id === customerId && row.place_id === placeId);
}

/** The property an estimate or invoice is for: its own, else the contact's default. */
export async function documentPlaceId(
  admin: Admin,
  doc: { kind: 'estimate' | 'invoice'; id: string }
): Promise<string | null> {
  const { data } =
    doc.kind === 'estimate'
      ? await admin.from('pro_crm_estimates').select('customer_id, place_id').eq('id', doc.id).maybeSingle()
      : await admin.from('pro_crm_invoices').select('customer_id, place_id').eq('id', doc.id).maybeSingle();
  if (!data) return null;
  if (data.place_id) return data.place_id;
  const { data: contact } = await admin.from('pro_crm_customers').select('place_id').eq('id', data.customer_id).maybeSingle();
  return contact?.place_id ?? null;
}

/** Does this customer see the estimate or invoice on this place? Used by the My Places routes. */
export async function docBelongsToPlace(
  admin: Admin,
  params: { userId: string; placeId: string; doc: { customer_id: string; place_id?: string | null } }
): Promise<boolean> {
  const contacts = await contactsOnPlace(admin, params.userId, params.placeId);
  return docIsOnPlace(params.doc, params.placeId, contacts);
}

export type PickedDocPlace = { ok: true; placeId: string | null } | { ok: false; error: string };

/**
 * The property sent with a new or edited estimate or invoice. Empty means the contact's default
 * house; anything else must be one of the contact's linked houses.
 */
export async function pickDocPlaceId(customerId: string, raw: unknown): Promise<PickedDocPlace> {
  const admin = createServiceRoleClient();
  if (raw === null || raw === undefined || raw === '') {
    // With no My Places default, name the first property outright, so the document stays on it
    // if the customer later shares a house that becomes the contact's default.
    const { data: contact } = await admin.from('pro_crm_customers').select('place_id').eq('id', customerId).maybeSingle();
    if (contact?.place_id) return { ok: true, placeId: null };
    const first = (await listContactProperties(admin, customerId))[0];
    return { ok: true, placeId: first?.id || null };
  }
  if (typeof raw !== 'string') return { ok: false, error: "Choose one of this customer's properties." };
  if (!(await contactHasPlace(admin, customerId, raw))) {
    return { ok: false, error: "That property is not one of this customer's properties." };
  }
  return { ok: true, placeId: raw };
}

/** After an estimate or invoice moves to another house, drop its timeline rows on the old one. */
export async function dropDocEventsOffPlace(doc: { kind: 'estimate' | 'invoice'; id: string }): Promise<void> {
  const admin = createServiceRoleClient();
  const placeId = await documentPlaceId(admin, doc);
  let query = admin.from('customer_place_events').delete().eq(doc.kind === 'estimate' ? 'estimate_id' : 'invoice_id', doc.id);
  if (placeId) query = query.neq('place_id', placeId);
  const { error } = await query;
  if (error) console.error('dropDocEventsOffPlace', error.message);
}

/**
 * The house an estimate or invoice is on right now, as the chat card shows it: its own house or
 * the contact's default, and only while that house is still on the customer's My Places.
 */
export async function docPlaceLabel(
  admin: Admin,
  doc: { kind: 'estimate' | 'invoice'; id: string; customerId: string }
): Promise<{ id: string; name: string } | null> {
  const [placeId, { data: contact }] = await Promise.all([
    documentPlaceId(admin, doc),
    admin.from('pro_crm_customers').select('portal_user_id').eq('id', doc.customerId).maybeSingle(),
  ]);
  if (!placeId || !contact?.portal_user_id) return null;
  const { data: place } = await admin
    .from('customer_places')
    .select('id, name')
    .eq('id', placeId)
    .eq('user_id', contact.portal_user_id)
    .maybeSingle();
  return place ? { id: place.id, name: place.name } : null;
}
