'use client';

import { createClient } from '@/lib/supabase/client';
import type { Supplier } from '@/app/[locale]/(main)/prosuppliers/SupplierCard';

interface SupplierRow {
  id: number;
  name: string;
  supplier_type: string;
  materials: string[] | null;
  address: string;
  phone: string;
  website: string;
  logo: string | null;
  latitude: number | null;
  longitude: number | null;
}

function mapSupplierRow(row: SupplierRow): Supplier {
  return {
    id: row.id,
    name: row.name,
    type: row.supplier_type,
    materials: row.materials ?? [],
    address: row.address,
    phone: row.phone,
    website: row.website,
    logo: row.logo ?? undefined,
    coordinates:
      row.latitude != null && row.longitude != null
        ? { lat: row.latitude, lng: row.longitude }
        : undefined,
  };
}

/** Loads supplier branches from Supabase. */
export async function loadSuppliers(): Promise<Supplier[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('suppliers')
    .select('id, name, supplier_type, materials, address, phone, website, logo, latitude, longitude')
    .order('id', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapSupplierRow);
}
