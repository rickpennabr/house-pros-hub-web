import { NextResponse } from 'next/server';
import { requireContractor } from '@/lib/crm/require-contractor';
import { createServiceRoleClient } from '@/lib/supabase/server';
import { listContactProperties, type ContactProperty } from '@/lib/places/contact-places';

const ID_CHUNK = 200;
const LOAD_CHUNK = 10;

/**
 * GET /api/crm/customers/properties
 * Every property of the pro's contacts that have more than one, keyed by contact id. Pickers
 * list one row per property, so a contact with two houses shows up twice. Contacts with one
 * property are left out: their contact address is already in the contact list.
 */
export async function GET() {
  try {
    const { error: authError, user } = await requireContractor();
    if (authError || !user) return authError!;

    const admin = createServiceRoleClient();
    const { data: contacts, error } = await admin
      .from('pro_crm_customers')
      .select('id, place_id')
      .eq('owner_id', user.id);
    if (error) throw error;

    const allIds = (contacts ?? []).map((contact) => contact.id);
    const placed = new Set((contacts ?? []).filter((contact) => contact.place_id).map((contact) => contact.id));
    for (let i = 0; i < allIds.length; i += ID_CHUNK) {
      const { data: links, error: linkError } = await admin
        .from('pro_crm_customer_places')
        .select('customer_id')
        .in('customer_id', allIds.slice(i, i + ID_CHUNK));
      if (linkError) throw linkError;
      for (const link of links ?? []) placed.add(link.customer_id);
    }

    const byCustomer: Record<string, ContactProperty[]> = {};
    const ids = [...placed];
    for (let i = 0; i < ids.length; i += LOAD_CHUNK) {
      const chunk = ids.slice(i, i + LOAD_CHUNK);
      const lists = await Promise.all(chunk.map((id) => listContactProperties(admin, id)));
      chunk.forEach((id, index) => {
        if (lists[index].length > 1) byCustomer[id] = lists[index];
      });
    }
    return NextResponse.json({ byCustomer });
  } catch (err) {
    console.error('GET /api/crm/customers/properties', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
