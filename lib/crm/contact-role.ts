import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/supabase';

export interface CrmContactRole {
  id: string;
  name: string;
  slug: string;
  can_invoice: boolean;
  is_system: boolean;
}

type Client = SupabaseClient<Database>;

interface RoleRow {
  id: string;
  name: string;
  slug: string;
  can_invoice: boolean;
  is_system: boolean;
  sort_order?: number;
}

export function toContactRole(row: RoleRow): CrmContactRole {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    can_invoice: row.can_invoice,
    is_system: row.is_system,
  };
}

export function slugifyRoleName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export function parseRoleIds(body: unknown): string[] | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const record = body as { roleIds?: unknown; role_ids?: unknown };
  const raw = record.roleIds ?? record.role_ids;
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((id): id is string => typeof id === 'string' && id.trim().length > 0))];
}

export async function listContactRoles(supabase: Client, ownerId: string): Promise<CrmContactRole[]> {
  const { data, error } = await supabase
    .from('pro_crm_roles')
    .select('id, name, slug, can_invoice, is_system, sort_order')
    .or(`owner_id.is.null,owner_id.eq.${ownerId}`)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => toContactRole(row));
}

/** Replace the roles on a contact. An empty list is rejected. Omitted on update leaves roles as they are. */
export async function replaceContactRoles(
  supabase: Client,
  ownerId: string,
  contactId: string,
  roleIds: string[]
): Promise<{ error: string; status: number } | null> {
  if (roleIds.length === 0) {
    return { error: 'Choose at least one role', status: 400 };
  }

  const { data: roles, error: roleError } = await supabase
    .from('pro_crm_roles')
    .select('id')
    .in('id', roleIds)
    .or(`owner_id.is.null,owner_id.eq.${ownerId}`);
  if (roleError) return { error: roleError.message, status: 500 };
  if ((roles ?? []).length !== roleIds.length) {
    return { error: 'One of those roles is not available', status: 400 };
  }

  const { data: current, error: currentError } = await supabase
    .from('pro_crm_contact_roles')
    .select('role_id')
    .eq('contact_id', contactId);
  if (currentError) return { error: currentError.message, status: 500 };

  const currentIds = new Set((current ?? []).map((row) => row.role_id));
  const nextIds = new Set(roleIds);
  const toAdd = roleIds.filter((id) => !currentIds.has(id));
  const toRemove = [...currentIds].filter((id) => !nextIds.has(id));

  if (toAdd.length > 0) {
    const { error: insertError } = await supabase
      .from('pro_crm_contact_roles')
      .insert(toAdd.map((roleId) => ({ contact_id: contactId, role_id: roleId })));
    if (insertError) return { error: insertError.message, status: 500 };
  }
  if (toRemove.length > 0) {
    const { error: deleteError } = await supabase
      .from('pro_crm_contact_roles')
      .delete()
      .eq('contact_id', contactId)
      .in('role_id', toRemove);
    if (deleteError) return { error: deleteError.message, status: 500 };
  }
  return null;
}

export async function assignDefaultCustomerRole(
  supabase: Client,
  contactId: string
): Promise<{ error: string; status: number } | null> {
  const { data: role, error } = await supabase
    .from('pro_crm_roles')
    .select('id')
    .is('owner_id', null)
    .eq('slug', 'customer')
    .maybeSingle();
  if (error) return { error: error.message, status: 500 };
  if (!role) return { error: 'Customer role is not set up', status: 500 };
  const { error: insertError } = await supabase
    .from('pro_crm_contact_roles')
    .insert({ contact_id: contactId, role_id: role.id });
  if (insertError) return { error: insertError.message, status: 500 };
  return null;
}

type RoleEmbed = { id: string; name: string; slug: string; can_invoice: boolean; is_system: boolean } | null;

export async function rolesByContactId(
  supabase: Client,
  contactIds: string[]
): Promise<Map<string, CrmContactRole[]>> {
  const grouped = new Map<string, CrmContactRole[]>();
  if (contactIds.length === 0) return grouped;
  const { data, error } = await supabase
    .from('pro_crm_contact_roles')
    .select('contact_id, pro_crm_roles(id, name, slug, can_invoice, is_system, sort_order)')
    .in('contact_id', contactIds);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as Array<{
    contact_id: string;
    pro_crm_roles: (RoleEmbed & { sort_order?: number }) | Array<RoleEmbed & { sort_order?: number }> | null;
  }>;
  for (const row of rows) {
    const role = Array.isArray(row.pro_crm_roles) ? row.pro_crm_roles[0] : row.pro_crm_roles;
    if (!role) continue;
    const list = grouped.get(row.contact_id) ?? [];
    list.push(toContactRole(role));
    grouped.set(row.contact_id, list);
  }
  for (const list of grouped.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }
  return grouped;
}

/** True when the contact has at least one role that can be invoiced. */
export async function contactCanBeInvoiced(supabase: Client, contactId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('pro_crm_contact_roles')
    .select('role_id, pro_crm_roles!inner(can_invoice)')
    .eq('contact_id', contactId)
    .eq('pro_crm_roles.can_invoice', true)
    .limit(1);
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

export async function contactIdsForRole(
  supabase: Client,
  slug: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from('pro_crm_contact_roles')
    .select('contact_id, pro_crm_roles!inner(slug)')
    .eq('pro_crm_roles.slug', slug);
  if (error) throw new Error(error.message);
  return [...new Set((data ?? []).map((row) => row.contact_id))];
}

export async function billableContactIds(supabase: Client): Promise<string[]> {
  const { data, error } = await supabase
    .from('pro_crm_contact_roles')
    .select('contact_id, pro_crm_roles!inner(can_invoice)')
    .eq('pro_crm_roles.can_invoice', true);
  if (error) throw new Error(error.message);
  return [...new Set((data ?? []).map((row) => row.contact_id))];
}
