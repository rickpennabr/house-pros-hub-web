'use client';

import { createClient } from '@/lib/supabase/client';
import type { Supplier } from '@/app/[locale]/(main)/prosuppliers/SupplierCard';
import { mapSupplierRow, SUPPLIER_SELECT, type SupplierRow } from '@/lib/data/suppliers-shared';

export type { SupplierRow } from '@/lib/data/suppliers-shared';
export { mapSupplierRow, SUPPLIER_SELECT } from '@/lib/data/suppliers-shared';

/** Browser load for admin screens. Public pages use listPublishedSuppliers on the server. */
export async function loadSuppliers(): Promise<Supplier[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('suppliers')
    .select(SUPPLIER_SELECT)
    .order('id', { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as SupplierRow[]).map(mapSupplierRow);
}
