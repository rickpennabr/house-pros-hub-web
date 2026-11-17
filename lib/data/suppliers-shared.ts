import type { Supplier } from '@/app/[locale]/(main)/prosuppliers/SupplierCard';

export interface SupplierRow {
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

export const SUPPLIER_SELECT =
  'id, name, supplier_type, materials, address, phone, website, logo, latitude, longitude';

export function mapSupplierRow(row: SupplierRow): Supplier {
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
