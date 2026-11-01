import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ProductGrid } from '@/components/products/ProductGrid';
import { listPublishedProducts } from '@/lib/products/queries';
import { locales, type Locale } from '@/i18n';

function resolveLocale(value: string): Locale {
  return locales.includes(value as Locale) ? (value as Locale) : 'en';
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: resolveLocale(locale), namespace: 'proProducts' });
  return {
    title: t('title'),
    description: t('subtitle'),
  };
}

export default async function ProProductsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: localeParam } = await params;
  const locale = resolveLocale(localeParam);
  const t = await getTranslations({ locale, namespace: 'proProducts' });
  const { products } = await listPublishedProducts();

  return (
    <div className="px-1 pb-4 md:px-2">
      <h1 className="sr-only">{t('title')}</h1>
      {products.length === 0 ? (
        <p className="text-sm text-gray-700">{t('empty')}</p>
      ) : (
        <ProductGrid products={products} />
      )}
    </div>
  );
}
