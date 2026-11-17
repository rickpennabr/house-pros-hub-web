import { unstable_cache } from 'next/cache';
import { createPublicClient } from '@/lib/supabase/server';
import {
  getCatalogProduct,
  getCatalogProductByName,
  listCatalogProductCards,
} from '@/lib/products/catalog';
import type { ProProduct } from '@/lib/products/types';

function isMissingCatalog(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === '42P01' || error.code === 'PGRST205' || /base_products/i.test(error.message ?? '');
}

async function queryPublishedProducts(): Promise<{ products: ProProduct[]; unavailable: boolean }> {
  const supabase = createPublicClient();
  try {
    const products = await listCatalogProductCards(supabase);
    return { products, unavailable: false };
  } catch (error) {
    const known = error as { code?: string; message?: string };
    console.error('listPublishedProducts', error);
    return { products: [], unavailable: isMissingCatalog(known) };
  }
}

const getCachedPublishedProducts = unstable_cache(queryPublishedProducts, ['published-pro-products'], {
  revalidate: 60,
});

export function listPublishedProducts(): Promise<{ products: ProProduct[]; unavailable: boolean }> {
  return getCachedPublishedProducts();
}

async function queryPublishedProductById(id: number): Promise<ProProduct | null> {
  const supabase = createPublicClient();
  try {
    return await getCatalogProduct(supabase, id);
  } catch (error) {
    console.error('getPublishedProduct', error);
    return null;
  }
}

async function queryPublishedProductByName(name: string): Promise<ProProduct | null> {
  const supabase = createPublicClient();
  try {
    return await getCatalogProductByName(supabase, name);
  } catch (error) {
    console.error('getPublishedProduct by name', error);
    return null;
  }
}

export async function getPublishedProduct(slug: string): Promise<ProProduct | null> {
  if (/^\d+$/.test(slug)) {
    return unstable_cache(() => queryPublishedProductById(Number(slug)), ['published-pro-product', slug], {
      revalidate: 60,
    })();
  }
  const needle = slug.replace(/-/g, ' ').trim();
  return unstable_cache(() => queryPublishedProductByName(needle), ['published-pro-product-name', needle.toLowerCase()], {
    revalidate: 60,
  })();
}
