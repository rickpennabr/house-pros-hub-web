import { createServiceRoleClient } from '@/lib/supabase/server';
import { getCachedDirectoryCategories, getCachedDirectoryCities } from '@/lib/data/businessDirectory';
import { listCatalogProducts } from '@/lib/products/catalog';

export interface SitemapBusiness {
  slug: string;
  updatedAt: Date | null;
}

export interface SitemapPost {
  slug: string;
  locale: string;
  updatedAt: Date | null;
}

export interface SitemapRecord {
  slug: string;
  updatedAt: Date | null;
}

export interface SitemapContent {
  businesses: SitemapBusiness[];
  cities: string[];
  categories: string[];
  posts: SitemapPost[];
  products: SitemapRecord[];
  installers: SitemapRecord[];
}

function asDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const EMPTY: SitemapContent = {
  businesses: [],
  cities: [],
  categories: [],
  posts: [],
  products: [],
  installers: [],
};

/** Public URLs for the sitemap. A failed query leaves that section empty. */
export async function loadSitemapContent(): Promise<SitemapContent> {
  try {
    const supabase = createServiceRoleClient();
    const [businesses, cities, categories, posts, products, installers] = await Promise.all([
      supabase.from('businesses').select('id, slug, updated_at').eq('is_active', true),
      getCachedDirectoryCities().catch(() => [] as string[]),
      getCachedDirectoryCategories().catch(() => [] as string[]),
      supabase.from('blog_posts').select('slug, locale, updated_at, published_at').eq('published', true),
      listCatalogProducts(supabase).catch(() => []),
      supabase.from('installer_profiles').select('slug, updated_at'),
    ]);

    return {
      businesses: (businesses.data ?? [])
        .map((row) => ({
          slug: row.slug || row.id,
          updatedAt: asDate(row.updated_at),
        }))
        .filter((row) => Boolean(row.slug)),
      cities,
      categories,
      posts: (posts.data ?? [])
        .filter((row) => row.slug && row.locale)
        .map((row) => ({
          slug: row.slug,
          locale: row.locale,
          updatedAt: asDate(row.updated_at || row.published_at),
        })),
      products: products.map((product) => ({
        slug: product.slug,
        updatedAt: asDate(product.updated_at),
      })),
      installers: (installers.data ?? [])
        .filter((row) => row.slug)
        .map((row) => ({
          slug: row.slug,
          updatedAt: asDate(row.updated_at),
        })),
    };
  } catch (error) {
    console.error('loadSitemapContent', error);
    return EMPTY;
  }
}
