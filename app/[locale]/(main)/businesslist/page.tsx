import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { DIRECTORY_CARD_PAGE_SIZE } from '@/lib/constants/businessDirectory';
import { sanitizeDirectoryCategory, sanitizeDirectoryCity, directoryPath } from '@/lib/data/directoryParams';
import {
  getBusinessDirectoryPage,
  getCachedDirectoryCities,
  searchBusinessesForAgents,
} from '@/lib/data/businessDirectory';
import { absoluteUrl, jsonLdScript, localizedPath, resolveLocale } from '@/lib/seo/metadata';
import { DirectoryCityLinks } from '@/components/seo/DirectoryCityLinks';
import BusinessListClient from './BusinessListClient';
import type { ProCardData } from '@/components/proscard/ProCard';

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function directoryCopy(
  t: Awaited<ReturnType<typeof getTranslations>>,
  category: string,
  city: string
): { title: string; description: string } {
  if (category && city) {
    return {
      title: t('seoCategoryCityTitle', { category, city }),
      description: t('seoCategoryCityDescription', { category, city }),
    };
  }
  if (category) {
    return {
      title: t('seoCategoryTitle', { category }),
      description: t('seoCategoryDescription', { category }),
    };
  }
  if (city) {
    return {
      title: t('seoCityTitle', { city }),
      description: t('seoCityDescription', { city }),
    };
  }
  return { title: t('seoTitle'), description: t('seoDescription') };
}

function itemListJsonLd(
  locale: string,
  path: string,
  businesses: ProCardData[],
  total: number,
  title: string,
  description: string
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    description,
    url: absoluteUrl(localizedPath(locale, path)),
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: total,
      itemListElement: businesses.slice(0, 10).map((business, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'HomeAndConstructionBusiness',
          name: business.businessName,
          description: business.companyDescription || business.contractorType,
          url: absoluteUrl(localizedPath('en', `/business/${business.slug || business.id}`)),
        },
      })),
    },
  };
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string | string[]; city?: string | string[] }>;
}): Promise<Metadata> {
  const { locale: localeParam } = await params;
  const locale = resolveLocale(localeParam);
  const query = await searchParams;
  const category = sanitizeDirectoryCategory(firstParam(query.category));
  const city = sanitizeDirectoryCity(firstParam(query.city));
  const t = await getTranslations({ locale, namespace: 'businessList' });
  const { title, description } = directoryCopy(t, category, city);
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
    },
  };
}

/**
 * Business list page: server-fetches the first card page for a fast first paint.
 * Category and city are part of the URL so those listings can be indexed.
 */
export default async function BusinessListPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string | string[]; city?: string | string[] }>;
}) {
  const { locale: localeParam } = await params;
  const locale = resolveLocale(localeParam);
  const query = await searchParams;
  const category = sanitizeDirectoryCategory(firstParam(query.category));
  const city = sanitizeDirectoryCity(firstParam(query.city));
  const t = await getTranslations({ locale, namespace: 'businessList' });
  const { title, description } = directoryCopy(t, category, city);
  const page = city
    ? await searchBusinessesForAgents({
        limit: DIRECTORY_CARD_PAGE_SIZE,
        offset: 0,
        category,
        city,
      })
    : await getBusinessDirectoryPage({
        limit: DIRECTORY_CARD_PAGE_SIZE,
        offset: 0,
        category,
      });
  let cities: string[] = [];
  try {
    cities = await getCachedDirectoryCities();
  } catch {
    cities = [];
  }

  return (
    <>
      <h1 className="sr-only">{title}</h1>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(
            itemListJsonLd(locale, directoryPath(category, city), page.businesses, page.total, title, description)
          ),
        }}
      />
      <Suspense fallback={null}>
        <BusinessListClient
          initialBusinesses={page.businesses}
          initialTotal={page.total}
          initialCategory={category || 'All'}
          initialCity={city}
        />
      </Suspense>
      <DirectoryCityLinks locale={locale} cities={cities} category={category} />
    </>
  );
}
