import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/supabase';
import { contactDisplayName } from '@/lib/crm/contact-name';

type Client = SupabaseClient<Database>;

export function categoryNeedsSupplier(category: string): boolean {
  const key = category.trim().toLowerCase();
  return key === 'materials' || key === 'equipment';
}

export function cleanExpenseText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export interface ExpenseOrderFields {
  po_number: string | null;
  quantity: number | null;
  unit: string | null;
  requested_by: string | null;
  ordered_by: string | null;
}

function cleanQuantity(value: unknown): number | null {
  if (value == null || value === '') return null;
  const amount = typeof value === 'number' ? value : parseFloat(String(value));
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 1000) / 1000;
}

/** PO, quantity, unit, and who asked or placed the order. Kept for materials and equipment. */
export function parseExpenseOrderFields(category: string | undefined, body: Record<string, unknown>): ExpenseOrderFields {
  if (category !== undefined && !categoryNeedsSupplier(category)) {
    return { po_number: null, quantity: null, unit: null, requested_by: null, ordered_by: null };
  }
  return {
    po_number: cleanExpenseText(body.poNumber ?? body.po_number),
    quantity: cleanQuantity(body.quantity),
    unit: cleanExpenseText(body.unit),
    requested_by: cleanExpenseText(body.requestedBy ?? body.requested_by),
    ordered_by: cleanExpenseText(body.orderedBy ?? body.ordered_by),
  };
}

/** A supplier on an expense is any contact this contractor owns. */
export async function resolveOwnedSupplierId(
  supabase: Client,
  ownerId: string,
  supplierId: unknown
): Promise<{ id: string | null; error: string | null; status: number }> {
  if (supplierId == null || supplierId === '') return { id: null, error: null, status: 200 };
  if (typeof supplierId !== 'string') return { id: null, error: 'Supplier not found', status: 400 };
  const { data, error } = await supabase
    .from('pro_crm_customers')
    .select('id')
    .eq('id', supplierId)
    .eq('owner_id', ownerId)
    .maybeSingle();
  if (error) return { id: null, error: error.message, status: 500 };
  if (!data) return { id: null, error: 'Supplier not found', status: 404 };
  return { id: data.id, error: null, status: 200 };
}

export async function supplierNamesById(
  supabase: Client,
  supplierIds: string[]
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const ids = [...new Set(supplierIds.filter(Boolean))];
  if (ids.length === 0) return names;
  const { data } = await supabase
    .from('pro_crm_customers')
    .select('id, display_name, company_name, first_name, last_name')
    .in('id', ids);
  for (const contact of data ?? []) {
    names.set(contact.id, contactDisplayName(contact));
  }
  return names;
}
