import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/supabase';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { mergeMatchingProProperties, streetMatchKey } from '@/lib/places/merge-pro-property';

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
import { autoNickname } from '@/lib/places/auto-nickname';

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
            name: contact.address_nickname?.trim() || autoNickname(street, contact.portal_kind ?? 'house') || CONTACT_ADDRESS_NAME,
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

export interface PropertyUpdate {
  /** The house is on the customer's My Places (they and any other pro on it see the change). */
  customerOwned: boolean;
  /** What changed, e.g. "Address: 1 Main St → 1 Main Street". */
  changes: string[];
}

/**
 * Fix a property's details. The pro may edit any property on their contact: the ones they added
 * and the customer's My Places houses on the contact. Null when the property is not on the contact.
 */
export async function updateContactProperty(
  admin: Admin,
  params: { customerId: string; ownerId: string; placeId: string; input: ProPropertyInput }
): Promise<PropertyUpdate | null> {
  const [{ data: link }, { data: contact }, { data: place }] = await Promise.all([
    admin
      .from('pro_crm_customer_places')
      .select('id')
      .eq('customer_id', params.customerId)
      .eq('owner_id', params.ownerId)
      .eq('place_id', params.placeId)
      .maybeSingle(),
    admin
      .from('pro_crm_customers')
      .select('id, place_id, portal_user_id')
      .eq('id', params.customerId)
      .eq('owner_id', params.ownerId)
      .maybeSingle(),
    admin
      .from('customer_places')
      .select('id, user_id, owner_id, name, kind, street, city, state, zip_code')
      .eq('id', params.placeId)
      .maybeSingle(),
  ]);
  if (!contact || !place || (!link && contact.place_id !== place.id)) return null;
  const allowed = place.user_id ? place.user_id === contact.portal_user_id : place.owner_id === params.ownerId;
  if (!allowed) return null;

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
    .eq('id', place.id);
  if (error) throw new Error(error.message);

  const line = (row: { street: string | null; city: string | null; state: string | null; zip: string | null }) =>
    [row.street, row.city, [row.state, row.zip].filter(Boolean).join(' ')].filter((part) => part?.trim()).join(', ');
  const before = line({ street: place.street, city: place.city, state: place.state, zip: place.zip_code });
  const after = line({ street: input.street, city: input.city, state: input.state, zip: input.zipCode });
  const changes: string[] = [];
  if (place.name !== input.name) changes.push(`Nickname: ${place.name} → ${input.name}`);
  if (place.kind !== input.kind) changes.push(`Type: ${place.kind} → ${input.kind}`);
  if (before !== after) changes.push(`Address: ${before || '—'} → ${after || '—'}`);
  return { customerOwned: Boolean(place.user_id), changes };
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
    .select(
      'id, owner_id, place_id, portal_user_id, portal_kind, address_nickname, street_address, apartment, city, state, zip_code, billing_address_street_1, billing_address_street_2, billing_address_city, billing_address_state, billing_address_zip_code'
    )
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

  // The first house becomes the default, which records with no property follow. When the
  // contact's own address is somewhere else, keep those records there as a property of the pro.
  if (!contact.place_id) await keepContactAddressRecords(admin, contact, place);

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
  // A property the pro added at this same address is this house: move its records here.
  try {
    await mergeMatchingProProperties(admin, { customerId: contact.id, ownerId: contact.owner_id, placeId: place.id });
  } catch (mergeError) {
    console.error('linkContactPlace merge', mergeError);
  }
  return !existing && contact.place_id !== place.id;
}

type ContactForAddress = {
  id: string;
  owner_id: string;
  portal_kind: ContactProperty['kind'] | null;
  address_nickname: string | null;
  street_address: string | null;
  apartment: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  billing_address_street_1: string | null;
  billing_address_street_2: string | null;
  billing_address_city: string | null;
  billing_address_state: string | null;
  billing_address_zip_code: string | null;
};

/**
 * Before a customer's house becomes the contact's default: records filed on the contact's own
 * address (place_id NULL) would move to that house. When the house is a different street, save
 * the contact's address as a pro property first and put those records on it.
 */
async function keepContactAddressRecords(
  admin: Admin,
  contact: ContactForAddress,
  place: { street: string | null; zip_code: string | null }
): Promise<void> {
  const street = (contact.street_address || contact.billing_address_street_1 || '').trim();
  if (!street) return;
  const unit = (contact.street_address ? contact.apartment : contact.billing_address_street_2)?.trim() || '';
  const fullStreet = unit ? `${street}, ${unit}` : street;
  if (streetMatchKey(fullStreet) === streetMatchKey(place.street)) return;

  const tables = ['pro_crm_estimates', 'pro_crm_invoices', 'pro_crm_maintenance_plans'] as const;
  const counts = await Promise.all(
    tables.map((table) =>
      admin
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', contact.id)
        .is('place_id', null)
    )
  );
  const projectCount = await admin
    .from('pro_crm_projects')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', contact.id)
    .is('place_id', null);
  const hasProjects = !projectCount.error && (projectCount.count ?? 0) > 0;
  if (!hasProjects && counts.every((result) => (result.count ?? 0) === 0)) return;

  const kind = contact.portal_kind ?? 'house';
  const placeId = await addProProperty(admin, {
    customerId: contact.id,
    ownerId: contact.owner_id,
    input: {
      name: contact.address_nickname?.trim() || autoNickname(street, kind) || CONTACT_ADDRESS_NAME,
      kind,
      street: fullStreet,
      city: contact.city || contact.billing_address_city,
      state: contact.state || contact.billing_address_state,
      zipCode: contact.zip_code || contact.billing_address_zip_code,
    },
  });
  await Promise.all([
    ...tables.map((table) =>
      admin.from(table).update({ place_id: placeId }).eq('customer_id', contact.id).is('place_id', null)
    ),
    hasProjects
      ? admin.from('pro_crm_projects').update({ place_id: placeId }).eq('customer_id', contact.id).is('place_id', null)
      : Promise.resolve(),
  ]);
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
 * Is this estimate, invoice, maintenance agreement or project for the place? Its own property
 * when set, else the contact's default. The contact must be one of contactsOnPlace for this place.
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

export interface PlacedProject {
  id: string;
  customer_id: string;
  estimate_id: string | null;
  /** The project's property: its own, else the estimate it came from. NULL: the contact's default. */
  place_id: string | null;
  name: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  shared: boolean | null;
  created_at: string;
}

/**
 * These contacts' projects (shared or not), newest first, each with the property it is on, the
 * same way the pro's Customer portal places them. Before migration 146 projects have no place_id
 * column and follow their estimate or the default.
 */
export async function loadPlacedProjects(admin: Admin, customerIds: string[]): Promise<PlacedProject[]> {
  if (customerIds.length === 0) return [];
  const columns = 'id, customer_id, estimate_id, name, status, start_date, end_date, shared, created_at';
  const first = await admin
    .from('pro_crm_projects')
    .select(`${columns}, place_id`)
    .in('customer_id', customerIds)
    .order('created_at', { ascending: false });
  let rows: Array<Omit<PlacedProject, 'place_id'> & { place_id: string | null }> = first.data ?? [];
  if (first.error) {
    if (!/place_id/.test(first.error.message)) throw new Error(first.error.message);
    const retry = await admin
      .from('pro_crm_projects')
      .select(columns)
      .in('customer_id', customerIds)
      .order('created_at', { ascending: false });
    if (retry.error) throw new Error(retry.error.message);
    rows = (retry.data ?? []).map((row) => ({ ...row, place_id: null }));
  }
  const estimateIds = [...new Set(rows.filter((row) => !row.place_id && row.estimate_id).map((row) => row.estimate_id!))];
  const { data: estimates } = estimateIds.length
    ? await admin.from('pro_crm_estimates').select('id, place_id').in('id', estimateIds)
    : { data: [] as { id: string; place_id: string | null }[] };
  const estimatePlace = new Map((estimates ?? []).map((row) => [row.id, row.place_id]));
  return rows.map((row) => ({
    ...row,
    place_id: row.place_id ?? (row.estimate_id ? estimatePlace.get(row.estimate_id) ?? null : null),
  }));
}

/**
 * Is this file on the place? A file on a project follows that project; any other file goes on the
 * contact's default property. `projects` must hold all of the contact's projects (not only shared).
 */
export function fileIsOnPlace(
  file: { customer_id: string; project_id: string | null },
  projects: Map<string, { customer_id: string; place_id: string | null }>,
  placeId: string,
  contacts: PlacedContact[]
): boolean {
  const project = file.project_id ? projects.get(file.project_id) : undefined;
  return docIsOnPlace(project ?? { customer_id: file.customer_id, place_id: null }, placeId, contacts);
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
