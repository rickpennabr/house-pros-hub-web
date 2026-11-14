import type { SupabaseClient } from '@supabase/supabase-js';
import { combinedPersonName } from '@/lib/crm/contact-name';
import { assignDefaultCustomerRole, contactCanBeInvoiced } from '@/lib/crm/contact-role';
import { displayNameTaken } from '@/lib/crm/display-name';
import {
  mailingFromHub,
  parseHubContact,
  phoneForCrm,
  publicHubContact,
  hubPersonName,
  type HubContact,
  type PublicHubContact,
} from '@/lib/crm/hub-customer-copy';
import { createServiceRoleClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/types/supabase';

type Client = SupabaseClient<Database>;

export interface OwnedHubCustomer {
  id: string;
  first_name: string;
  last_name: string;
  display_name: string | null;
  company_name: string | null;
}

export type ImportHubCustomerResult =
  | { ok: true; created: boolean; customer: OwnedHubCustomer }
  | { ok: true; fill: true; contact: PublicHubContact }
  | { ok: false; status: number; error: string };

const CUSTOMER_FIELDS =
  'id, first_name, last_name, display_name, company_name, email, phone, street_address, apartment, city, state, zip_code, billing_address_street_1';

interface OwnedRow {
  id: string;
  first_name: string;
  last_name: string;
  display_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  street_address: string | null;
  apartment: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  billing_address_street_1: string | null;
}

/**
 * Confirmed customer account for this exact email.
 * Reads the person's profile only. Never reads another pro's contacts.
 */
export async function lookupHubCustomer(email: string): Promise<HubContact | null> {
  const admin = createServiceRoleClient();
  const { data, error } = await admin.rpc('hub_customer_contact_by_email', { p_email: email });
  if (error) {
    console.error('hub customer lookup', error.message);
    throw new Error('LOOKUP_FAILED');
  }
  return parseHubContact(data);
}

async function availableDisplayName(supabase: Client, ownerId: string, base: string, email: string): Promise<string> {
  const local = email.split('@')[0]?.slice(0, 40) || 'account';
  const candidates = [base, `${base} (${local})`];
  for (let n = 2; n < 20; n += 1) candidates.push(`${base} ${n}`);
  for (const candidate of candidates) {
    const name = candidate.trim().slice(0, 160);
    if (name && !(await displayNameTaken(supabase, ownerId, name))) return name;
  }
  throw new Error('DISPLAY_NAME');
}

function toOption(row: Pick<OwnedRow, 'id' | 'first_name' | 'last_name' | 'display_name' | 'company_name'>): OwnedHubCustomer {
  return {
    id: row.id,
    first_name: row.first_name,
    last_name: row.last_name,
    display_name: row.display_name,
    company_name: row.company_name,
  };
}

async function ensureBillable(supabase: Client, contactId: string): Promise<{ error: string; status: number } | null> {
  if (await contactCanBeInvoiced(supabase, contactId)) return null;
  return assignDefaultCustomerRole(supabase, contactId);
}

/**
 * Point this pro's contact at the hub login when the email matches.
 * Leaves a link that is already set. Does not copy another pro's records.
 */
export async function attachHubLogin(contactId: string, ownerId: string, email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (!normalized || normalized.length > 320) return;
  const hub = await lookupHubCustomer(normalized);
  if (!hub) return;

  const admin = createServiceRoleClient();
  const { data: row } = await admin
    .from('pro_crm_customers')
    .select('id, street_address, zip_code, portal_user_id')
    .eq('id', contactId)
    .eq('owner_id', ownerId)
    .maybeSingle();
  if (!row) return;
  if (row.portal_user_id && row.portal_user_id !== hub.userId) return;

  if (!row.portal_user_id) {
    const { error } = await admin
      .from('pro_crm_customers')
      .update({ portal_user_id: hub.userId })
      .eq('id', contactId)
      .eq('owner_id', ownerId)
      .is('portal_user_id', null);
    if (error) throw new Error(error.message);
  }

  const mailing = mailingFromHub({
    ...hub,
    streetAddress: row.street_address || hub.streetAddress,
    zipCode: row.zip_code || hub.zipCode,
  });
  if (!mailing.placeId) return;
  const { error: placeError } = await admin
    .from('pro_crm_customers')
    .update({ place_id: mailing.placeId, portal_kind: mailing.portalKind })
    .eq('id', contactId)
    .eq('owner_id', ownerId)
    .eq('portal_user_id', hub.userId)
    .is('place_id', null);
  if (placeError) throw new Error(placeError.message);
}

async function fillBlankAddress(supabase: Client, ownerId: string, row: OwnedRow, hub: HubContact): Promise<void> {
  const mailing = mailingFromHub(hub);
  const patch: Database['public']['Tables']['pro_crm_customers']['Update'] = {};
  if (!row.street_address && mailing.streetAddress) {
    patch.street_address = mailing.streetAddress;
    patch.apartment = mailing.apartment;
    patch.city = mailing.city;
    patch.state = mailing.state;
    patch.zip_code = mailing.zipCode;
  }
  if (!row.billing_address_street_1 && mailing.streetAddress) {
    patch.billing_address_street_1 = mailing.streetAddress;
    patch.billing_address_street_2 = mailing.apartment;
    patch.billing_address_city = mailing.city;
    patch.billing_address_state = mailing.state;
    patch.billing_address_zip_code = mailing.zipCode;
  }
  if (!row.phone) {
    const phone = phoneForCrm(hub.phone);
    if (phone) patch.phone = phone;
  }
  if (Object.keys(patch).length === 0) return;
  const { error } = await supabase.from('pro_crm_customers').update(patch).eq('id', row.id).eq('owner_id', ownerId);
  if (error) throw new Error(error.message);
}

/**
 * Copy one hub customer's own contact details into this pro's CRM.
 * fillOnly returns the fields and does not write a contact.
 */
export async function importHubCustomer(
  supabase: Client,
  ownerId: string,
  email: string,
  fillOnly: boolean
): Promise<ImportHubCustomerResult> {
  const hub = await lookupHubCustomer(email);
  if (!hub) return { ok: false, status: 404, error: 'No confirmed House Pros customer uses that email.' };
  if (fillOnly) return { ok: true, fill: true, contact: publicHubContact(hub) };

  const { data: owned, error: ownedError } = await supabase
    .from('pro_crm_customers')
    .select(CUSTOMER_FIELDS)
    .eq('owner_id', ownerId)
    .ilike('email', email);
  if (ownedError) return { ok: false, status: 500, error: 'Could not check your contacts' };

  const existing = ((owned ?? []) as OwnedRow[]).find(
    (row) => (row.email ?? '').trim().toLowerCase() === email
  );
  if (existing) {
    await fillBlankAddress(supabase, ownerId, existing, hub);
    const roleResult = await ensureBillable(supabase, existing.id);
    if (roleResult) return { ok: false, status: roleResult.status, error: roleResult.error };
    try {
      await attachHubLogin(existing.id, ownerId, email);
    } catch (err) {
      console.error('attach hub login', err instanceof Error ? err.message : err);
    }
    return { ok: true, created: false, customer: toOption(existing) };
  }

  const names = hubPersonName(hub);
  const mailing = mailingFromHub(hub);
  const displayName = await availableDisplayName(
    supabase,
    ownerId,
    combinedPersonName(names.firstName, names.lastName),
    email
  );
  const { data: created, error: insertError } = await supabase
    .from('pro_crm_customers')
    .insert({
      owner_id: ownerId,
      first_name: names.firstName,
      last_name: names.lastName,
      display_name: displayName,
      email,
      phone: phoneForCrm(hub.phone),
      street_address: mailing.streetAddress,
      apartment: mailing.apartment,
      city: mailing.city,
      state: mailing.state,
      zip_code: mailing.zipCode,
      billing_address_street_1: mailing.streetAddress,
      billing_address_street_2: mailing.apartment,
      billing_address_city: mailing.city,
      billing_address_state: mailing.state,
      billing_address_zip_code: mailing.zipCode,
      shipping_same_as_billing: true,
      invoice_language: 'en',
      opening_balance: 0,
    })
    .select('id, first_name, last_name, display_name, company_name')
    .single();
  if (insertError || !created) {
    const taken = insertError?.code === '23505';
    return {
      ok: false,
      status: taken ? 409 : 500,
      error: taken ? 'That display name is already used. Each contact needs a unique display name.' : 'Could not add the contact',
    };
  }

  const roleResult = await assignDefaultCustomerRole(supabase, created.id);
  if (roleResult) {
    await supabase.from('pro_crm_customers').delete().eq('id', created.id).eq('owner_id', ownerId);
    return { ok: false, status: roleResult.status, error: roleResult.error };
  }

  try {
    await attachHubLogin(created.id, ownerId, email);
  } catch (err) {
    console.error('attach hub login', err instanceof Error ? err.message : err);
  }
  return { ok: true, created: true, customer: toOption(created) };
}
