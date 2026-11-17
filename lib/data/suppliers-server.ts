import { unstable_cache } from 'next/cache';
import { createPublicClient } from '@/lib/supabase/server';
import type { Supplier } from '@/app/[locale]/(main)/prosuppliers/SupplierCard';
import { mapSupplierRow, SUPPLIER_SELECT, type SupplierRow } from '@/lib/data/suppliers-shared';

async function querySuppliers(): Promise<Supplier[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('suppliers')
    .select(SUPPLIER_SELECT)
    .order('id', { ascending: true });

  if (error) {
    console.error('listPublishedSuppliers', error);
    return [];
  }
  return ((data ?? []) as SupplierRow[]).map(mapSupplierRow);
}

const getCachedSuppliers = unstable_cache(querySuppliers, ['published-suppliers'], {
  revalidate: 60,
});

export function listPublishedSuppliers(): Promise<Supplier[]> {
  return getCachedSuppliers();
}
