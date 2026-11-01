import { unstable_cache } from 'next/cache';
import { createPublicClient } from '@/lib/supabase/server';
import type { BlogPost, BlogPostCard } from '@/lib/blog/types';

type BlogLocale = BlogPost['locale'];

function asBlogLocale(locale: string): BlogLocale {
  if (locale === 'es' || locale === 'pt') return locale;
  return 'en';
}

const LIST_COLUMNS =
  'id, slug, locale, title, excerpt, category, region, cover_image_url, published, published_at, created_at, updated_at';

export type { BlogPost, BlogPostCard };

function isMissingBlogTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === '42P01' || error.code === 'PGRST205' || /blog_posts/i.test(error.message ?? '');
}

const getCachedPublishedPosts = unstable_cache(
  (locale: string) => queryPublishedBlogPosts(locale),
  ['published-blog-posts'],
  { revalidate: 60 }
);

export function listPublishedBlogPosts(
  locale: string
): Promise<{ posts: BlogPostCard[]; unavailable: boolean }> {
  return getCachedPublishedPosts(locale);
}

async function queryPublishedBlogPosts(
  locale: string
): Promise<{ posts: BlogPostCard[]; unavailable: boolean }> {
  const supabase = createPublicClient();
  const primary = await supabase
    .from('blog_posts')
    .select(LIST_COLUMNS)
    .eq('published', true)
    .eq('locale', asBlogLocale(locale))
    .order('published_at', { ascending: false, nullsFirst: false });

  if (primary.error) {
    console.error('listPublishedBlogPosts', primary.error);
    return { posts: [], unavailable: isMissingBlogTable(primary.error) };
  }

  const primaryPosts = primary.data ?? [];
  if (primaryPosts.length > 0 || locale === 'en') {
    return { posts: primaryPosts, unavailable: false };
  }

  const fallback = await supabase
    .from('blog_posts')
    .select(LIST_COLUMNS)
    .eq('published', true)
    .eq('locale', 'en')
    .order('published_at', { ascending: false, nullsFirst: false });

  if (fallback.error) {
    console.error('listPublishedBlogPosts fallback', fallback.error);
    return { posts: [], unavailable: isMissingBlogTable(fallback.error) };
  }

  return { posts: fallback.data ?? [], unavailable: false };
}

const getCachedPublishedPost = unstable_cache(
  (locale: string, slug: string) => queryPublishedBlogPost(locale, slug),
  ['published-blog-post'],
  { revalidate: 60 }
);

export function getPublishedBlogPost(locale: string, slug: string): Promise<BlogPost | null> {
  return getCachedPublishedPost(locale, slug);
}

async function queryPublishedBlogPost(locale: string, slug: string): Promise<BlogPost | null> {
  const supabase = createPublicClient();
  const primary = await supabase
    .from('blog_posts')
    .select('*')
    .eq('published', true)
    .eq('locale', asBlogLocale(locale))
    .eq('slug', slug)
    .maybeSingle();

  if (primary.error) {
    console.error('getPublishedBlogPost', primary.error);
    return null;
  }
  if (primary.data) return primary.data;
  if (locale === 'en') return null;

  const fallback = await supabase
    .from('blog_posts')
    .select('*')
    .eq('published', true)
    .eq('locale', 'en')
    .eq('slug', slug)
    .maybeSingle();

  if (fallback.error) {
    console.error('getPublishedBlogPost fallback', fallback.error);
    return null;
  }
  return fallback.data;
}
