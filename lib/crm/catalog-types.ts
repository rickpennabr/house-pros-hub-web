import type { CatalogTermKind, PriceMode } from '@/lib/crm/catalog-options';

export interface CrmImage {
  id: string;
  image_url: string;
  storage_path: string | null;
  sort_order: number;
  is_thumbnail: boolean;
}

export interface CrmService {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  unit: string;
  price_type: string;
  price_mode: PriceMode;
  price_cents: number;
  price_min_cents: number | null;
  price_max_cents: number | null;
  images: CrmImage[];
  created_at: string;
}

export interface CrmProductSpec {
  id: string;
  name: string;
  value: string;
  sort_order: number;
}

export interface CrmProduct {
  id: string;
  name: string;
  brand: string;
  sku: string | null;
  upc: string | null;
  category: string | null;
  description: string | null;
  unit: string;
  price_cents: number;
  images: CrmImage[];
  specs: CrmProductSpec[];
  created_at: string;
}

export interface CrmCatalogTerm {
  id: string;
  kind: CatalogTermKind;
  label: string;
  price_mode: PriceMode | null;
}
