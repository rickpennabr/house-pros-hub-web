import type { MetadataRoute } from 'next';
import { locales } from '@/i18n';
import { siteOrigin } from '@/lib/agent/constants';

const DISALLOW = [
  '/admin',
  '/api/',
  '/*/crm',
  '/*/signin',
  '/*/signup',
  '/*/forgot-password',
  '/*/reset-password',
  '/*/account-management',
  '/*/prodrive',
  '/*/saved-businesses',
  '/*/business/add',
  '/*/business/edit',
  '/*/profile/edit',
  '/*/partners/manage',
  '/*/invoices',
  '/*/estimates',
  '/*/mapview',
];

export default function robots(): MetadataRoute.Robots {
  const origin = siteOrigin().replace(/\/$/, '');
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: DISALLOW,
    },
    sitemap: `${origin}/sitemap.xml`,
  };
}
