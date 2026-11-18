import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/supabase';
import type { ChatDocPlace } from '@/lib/types/chat';
import { parseAgentPayload } from '@/lib/chat/proagent-policy';
import { recordEstimateReceived, recordInvoiceReceived, recordProLinked } from '@/lib/places/timeline';
import { contactHasPlace, linkContactPlace } from '@/lib/places/contact-places';
type Admin = SupabaseClient<Database>;

function phoneKey(value: string | null | undefined): string | null {
  const digits = (value ?? '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : null;
}

function textKey(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

/**
 * Is this hand-entered CRM contact the person signed in to the chat?
 * Same email, same phone, or the same first and last name.
 */
async function contactIsChatCustomer(
  admin: Admin,
  contact: { email: string | null; phone: string | null; first_name: string | null; last_name: string | null },
  userId: string
): Promise<boolean> {
  const [{ data: profile }, { data: authUser }] = await Promise.all([
    admin.from('profiles').select('first_name, last_name, phone').eq('id', userId).maybeSingle(),
    admin.auth.admin.getUserById(userId),
  ]);
  const loginEmail = textKey(authUser?.user?.email);
  if (loginEmail && textKey(contact.email) === loginEmail) return true;
  const loginPhone = phoneKey(profile?.phone);
  if (loginPhone && phoneKey(contact.phone) === loginPhone) return true;
  const first = textKey(profile?.first_name);
  const last = textKey(profile?.last_name);
  return Boolean(first && last && textKey(contact.first_name) === first && textKey(contact.last_name) === last);
}

/** The latest of the customer's places they shared with this business in this chat. */
async function sharedPlaceId(
  admin: Admin,
  params: { userId: string; businessId: string; conversationId: string }
): Promise<string | null> {
  const { data: shares } = await admin
    .from('probot_messages')
    .select('payload')
    .eq('conversation_id', params.conversationId)
    .eq('business_id', params.businessId)
    .eq('sender', 'visitor')
    .not('payload', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20);
  for (const row of shares ?? []) {
    const placeId = parseAgentPayload(row.payload)?.placeShare?.placeId;
    if (!placeId) continue;
    const { data: place } = await admin
      .from('customer_places')
      .select('id, street')
      .eq('id', placeId)
      .eq('user_id', params.userId)
      .maybeSingle();
    // My Places requires an address; a place without a street is never a target.
    if (place?.street?.trim()) return place.id;
  }
  return null;
}

/**
 * The house for this estimate or invoice, only from the customer's own choices: the one the pro
 * picked on the document (one of the contact's houses), else the house shared in this chat, else
 * the contact's default house, else the house the customer approved for this pro's other contact.
 */
async function choosePlaceId(
  admin: Admin,
  params: {
    userId: string;
    ownerId: string;
    businessId: string;
    conversationId: string;
    contact: { id: string; place_id: string | null };
    docPlaceId: string | null;
  }
): Promise<string | null> {
  if (params.docPlaceId && (await contactHasPlace(admin, params.contact.id, params.docPlaceId))) return params.docPlaceId;

  const shared = await sharedPlaceId(admin, params);
  if (shared) return shared;
  if (params.contact.place_id) return params.contact.place_id;

  const { data: sibling } = await admin
    .from('pro_crm_customers')
    .select('place_id')
    .eq('owner_id', params.ownerId)
    .eq('portal_user_id', params.userId)
    .neq('id', params.contact.id)
    .not('place_id', 'is', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return sibling?.place_id ?? null;
}

/**
 * A pro posted a CRM estimate or invoice in a customer chat. File it on that customer's My Places:
 * link the CRM contact to the chat login when it is clearly the same person, pick the place, and
 * add the timeline row. Returns the place, or null when it cannot be filed safely.
 */
export async function fileChatDocOnPlace(
  admin: Admin,
  params: {
    ownerId: string;
    businessId: string;
    conversationId: string;
    doc: { kind: 'estimate' | 'invoice'; id: string };
  }
): Promise<ChatDocPlace | null> {
  const { ownerId, businessId, conversationId, doc } = params;

  let customerId: string | null = null;
  let docPlaceId: string | null = null;
  let estimate: { display_id: string | null; amount_cents: number | null; job_area: string | null } | null = null;
  let invoice: { invoice_number: string | null; amount_cents: number | null } | null = null;
  if (doc.kind === 'estimate') {
    const { data } = await admin
      .from('pro_crm_estimates')
      .select('customer_id, owner_id, place_id, display_id, amount_cents, job_area')
      .eq('id', doc.id)
      .maybeSingle();
    if (!data || data.owner_id !== ownerId) return null;
    customerId = data.customer_id;
    docPlaceId = data.place_id;
    estimate = data;
  } else {
    const { data } = await admin
      .from('pro_crm_invoices')
      .select('customer_id, owner_id, place_id, invoice_number, amount_cents')
      .eq('id', doc.id)
      .maybeSingle();
    if (!data || data.owner_id !== ownerId) return null;
    customerId = data.customer_id;
    docPlaceId = data.place_id;
    invoice = data;
  }
  if (!customerId) return null;

  const { data: conversation } = await admin
    .from('probot_conversations')
    .select('user_id')
    .eq('id', conversationId)
    .maybeSingle();
  const userId = conversation?.user_id;
  if (!userId) return null;

  const { data: contact } = await admin
    .from('pro_crm_customers')
    .select('id, portal_user_id, place_id, email, phone, first_name, last_name')
    .eq('id', customerId)
    .eq('owner_id', ownerId)
    .maybeSingle();
  if (!contact) return null;
  if (contact.portal_user_id && contact.portal_user_id !== userId) return null;

  if (!contact.portal_user_id) {
    if (!(await contactIsChatCustomer(admin, contact, userId))) return null;
    const { error } = await admin
      .from('pro_crm_customers')
      .update({ portal_user_id: userId })
      .eq('id', contact.id)
      .is('portal_user_id', null);
    if (error) {
      console.error('[fileChatDocOnPlace] link login', error.message);
      return null;
    }
  }

  const placeId = await choosePlaceId(admin, {
    userId,
    ownerId,
    businessId,
    conversationId,
    contact: { id: contact.id, place_id: contact.place_id },
    docPlaceId,
  });
  if (!placeId) return null;

  // Add the house to the contact's properties (the customer shared or approved it).
  try {
    if (await linkContactPlace(admin, { customerId: contact.id, ownerId, placeId })) {
      await recordProLinked({ placeId, customerId: contact.id, ownerId });
    }
  } catch (err) {
    console.error('[fileChatDocOnPlace] link place', err);
    return null;
  }

  // Pin the document to this house so My Places, the timeline and the CRM agree.
  if (docPlaceId !== placeId) {
    const table = doc.kind === 'estimate' ? 'pro_crm_estimates' : 'pro_crm_invoices';
    const { error } = await admin.from(table).update({ place_id: placeId }).eq('id', doc.id).eq('owner_id', ownerId);
    if (error) console.error('[fileChatDocOnPlace] pin place', error.message);
  }

  const { data: place } = await admin
    .from('customer_places')
    .select('id, name')
    .eq('id', placeId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!place) return null;

  if (estimate) {
    await recordEstimateReceived({
      customerId: contact.id,
      estimateId: doc.id,
      estimateNumber: estimate.display_id ?? doc.id.slice(0, 8),
      amountCents: estimate.amount_cents ?? 0,
      jobArea: estimate.job_area,
      ownerId,
    });
  } else if (invoice) {
    await recordInvoiceReceived({
      customerId: contact.id,
      invoiceId: doc.id,
      invoiceNumber: invoice.invoice_number ?? doc.id.slice(0, 8),
      amountCents: invoice.amount_cents ?? 0,
      ownerId,
    });
  }

  return { id: place.id, name: place.name };
}
