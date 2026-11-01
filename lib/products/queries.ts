import { createClient } from '@/lib/supabase/server';
import { getCatalogProduct, listCatalogProducts } from '@/lib/products/catalog';
import type { ProProduct } from '@/lib/products/types';

function isMissingCatalog(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === '42P01' || error.code === 'PGRST205' || /base_products/i.test(error.message ?? '');
}

export async function listPublishedProducts(): Promise<{ products: ProProduct[]; unavailable: boolean }> {
  const supabase = await createClient();
  try {
    const products = await listCatalogProducts(supabase);
    return { products, unavailable: false };
  } catch (error) {
    const known = error as { code?: string; message?: string };
    console.error('listPublishedProducts', error);
    return { products: [], unavailable: isMissingCatalog(known) };
  }
}

export async function getPublishedProduct(slug: string): Promise<ProProduct | null> {
  const supabase = await createClient();
  try {
    if (/^\d+$/.test(slug)) return await getCatalogProduct(supabase, Number(slug));
    const products = await listCatalogProducts(supabase);
    const needle = slug.replace(/-/g, ' ').toLowerCase();
    return products.find((product) => product.name.toLowerCase() === needle) ?? null;
  } catch (error) {
    console.error('getPublishedProduct', error);
    return null;
  }
}
