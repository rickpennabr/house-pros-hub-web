import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://houseproshub.com';

  // Static pages
  const routes = [
    '',
    '/businesslist',
    '/legal/terms',
    '/legal/privacy',
    '/legal/cookies',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: route === '' ? 1.0 : route === '/businesslist' ? 0.9 : 0.7,
  }));

  // Note: To include dynamic business pages, you would need to fetch all business slugs
  // from your database/storage and add them here. For now, we'll include just the base routes.
  // Example for dynamic business pages:
  // const businesses = businessStorage.getAllBusinesses();
  // const businessRoutes = businesses.map((business) => ({
  //   url: `${baseUrl}/business/${business.slug}`,
  //   lastModified: business.updatedAt || new Date(),
  //   changeFrequency: 'monthly' as const,
  //   priority: 0.8,
  // }));
  // return [...routes, ...businessRoutes];

  return routes;
}
