import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/supabase';
import { combinedPersonName } from '@/lib/crm/contact-name';

type Client = SupabaseClient<Database>;

/** Blank display names become First Last, then the company name. */
export function resolveContactDisplayName(input: {
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
}): string {
  const explicit = input.displayName?.trim() ?? '';
  if (explicit) return explicit;
  return combinedPersonName(input.firstName, input.lastName) || input.companyName?.trim() || '';
}

/** The same display name cannot be used by another contact for this pro. */
export async function displayNameTaken(
  supabase: Client,
  ownerId: string,
  displayName: string,
  exceptId?: string
): Promise<boolean> {
  const key = displayName.trim().toLowerCase();
  if (!key) return false;
  const { data, error } = await supabase
    .from('pro_crm_customers')
    .select('id, display_name')
    .eq('owner_id', ownerId)
    .ilike('display_name', displayName.trim());
  if (error) throw new Error(error.message);
  return (data ?? []).some(
    (row) => row.id !== exceptId && (row.display_name ?? '').trim().toLowerCase() === key
  );
}

export const DISPLAY_NAME_TAKEN =
  'That display name is already used. Each customer, vendor, and employee needs a unique display name.';
