import type { SupabaseClient } from '@supabase/supabase-js';

export interface PersonalAddress {
  street_address: string | null;
  apartment: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  gate_code: string | null;
  address_note: string | null;
}

export interface PersonalAddressInput {
  streetAddress?: string | null;
  apartment?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  gateCode?: string | null;
  addressNote?: string | null;
}

const ADDRESS_COLUMNS = 'street_address, apartment, city, state, zip_code, gate_code, address_note';

export async function getPersonalAddress(
  client: SupabaseClient,
  userId: string
): Promise<PersonalAddress | null> {
  const { data } = await client
    .from('addresses')
    .select(ADDRESS_COLUMNS)
    .eq('user_id', userId)
    .eq('address_type', 'personal')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as PersonalAddress | null) ?? null;
}

export async function upsertPersonalAddress(
  client: SupabaseClient,
  userId: string,
  input: PersonalAddressInput
): Promise<void> {
  const row = {
    street_address: input.streetAddress ?? null,
    apartment: input.apartment ?? null,
    city: input.city ?? null,
    state: input.state ?? null,
    zip_code: input.zipCode ?? null,
    gate_code: input.gateCode ?? null,
    address_note: input.addressNote ?? null,
  };

  const { data: existing } = await client
    .from('addresses')
    .select('id')
    .eq('user_id', userId)
    .eq('address_type', 'personal')
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    await client.from('addresses').update(row).eq('id', existing.id);
    return;
  }

  const hasValue = Object.values(row).some((value) => value != null && String(value).trim() !== '');
  if (!hasValue) return;

  await client.from('addresses').insert({
    user_id: userId,
    address_type: 'personal',
    is_public: false,
    is_verified: false,
    ...row,
  });
}
