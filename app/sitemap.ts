import type { MetadataRoute } from 'next';
import { locales, type Locale } from '@/i18n';
import { directoryPath } from '@/lib/data/directoryParams';
import { absoluteUrl, localizedPath } from '@/lib/seo/metadata';
import { loadSitemapContent } from '@/lib/seo/sitemapData';

export const revalidate = 3600;

const TRANSLATED_PATHS = [
  '/businesslist',
  '/projobs',
  '/proresume',
  '/prosuppliers',
  '/proproducts',
  '/blog',
  '/estimate',
  '/help',
  '/legal/terms',
  '/legal/privacy',
  '/legal/cookies',
];

function entry(
  path: string,
  locale: Locale,
  priority: number,
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'],
  lastModified?: Date | null
): MetadataRoute.Sitemap[number] {
  return {
    url: absoluteUrl(localizedPath(locale, path)),
    changeFrequency,
    priority,
    ...(lastModified ? { lastModified } : {}),
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const content = await loadSitemapContent();
  const pages: MetadataRoute.Sitemap = [];

  for (const locale of locales) {
    for (const path of TRANSLATED_PATHS) {
      const priority = path === '/businesslist' ? 1 : path === '/estimate' || path === '/blog' ? 0.8 : 0.6;
      pages.push(entry(path, locale, priority, 'weekly'));
    }
    for (const category of content.categories) {
      pages.push(entry(directoryPath(category), locale, 0.8, 'weekly'));
    }
    for (const city of content.cities) {
      pages.push(entry(directoryPath(null, city), locale, 0.8, 'weekly'));
    }
  }

  for (const business of content.businesses) {
    pages.push(entry(`/business/${business.slug}`, 'en', 0.8, 'weekly', business.updatedAt));
  }
  for (const product of content.products) {
    pages.push(entry(`/proproducts/${product.slug}`, 'en', 0.6, 'weekly', product.updatedAt));
  }
  for (const installer of content.installers) {
    pages.push(entry(`/installers/${installer.slug}`, 'en', 0.5, 'monthly', installer.updatedAt));
  }
  for (const post of content.posts) {
    const locale = locales.includes(post.locale as Locale) ? (post.locale as Locale) : 'en';
    pages.push(entry(`/blog/${post.slug}`, locale, 0.7, 'monthly', post.updatedAt));
  }

  return pages;
}
