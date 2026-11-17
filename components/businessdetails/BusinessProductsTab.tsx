'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Loader2, Package } from 'lucide-react';
import { TypingSearchInput } from '@/components/common/TypingSearchInput';
import { formatCents } from '@/lib/crm/catalog-options';
import type { CrmProduct } from '@/lib/crm/catalog-types';

interface BusinessProductsTabProps {
  businessId: string;
  isOwner: boolean;
}

export default function BusinessProductsTab({ businessId, isOwner }: BusinessProductsTabProps) {
  const t = useTranslations('businessProducts');
  const locale = useLocale();
  const [products, setProducts] = useState<CrmProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/businesses/${businessId}/products`, { credentials: 'include' });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || t('loadError'));
        if (!cancelled) setProducts((data.profileProducts ?? []) as CrmProduct[]);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('loadError'));
          setProducts([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [businessId, isOwner, t]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(q) ||
        product.brand.toLowerCase().includes(q) ||
        (product.category ?? '').toLowerCase().includes(q) ||
        (product.sku ?? '').toLowerCase().includes(q)
    );
  }, [products, query]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('loading')}
      </div>
    );
  }

  if (error) {
    return <p className="py-6 text-sm text-red-600">{error}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-black">{t('heading')}</h2>
        {isOwner ? (
          <Link
            href={`/${locale}/crm/products`}
            className="rounded-lg border-2 border-black px-3 py-1.5 text-sm font-medium hover:bg-black hover:text-white"
          >
            {t('manageInCrm')}
          </Link>
        ) : null}
      </div>

      {products.length > 0 ? (
        <TypingSearchInput
          value={query}
          onChange={setQuery}
          placeholder={t('search')}
          clearLabel={t('clearSearch')}
          className="w-full"
        />
      ) : null}

      {products.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-6 text-center">
          <Package className="mx-auto h-8 w-8 text-gray-400" />
          <p className="mt-2 text-sm text-gray-700">{isOwner ? t('emptyOwner') : t('empty')}</p>
          {isOwner ? (
            <p className="mt-1 text-xs text-gray-500">{t('emptyOwnerHint')}</p>
          ) : null}
        </div>
      ) : visible.length === 0 ? (
        <p className="text-sm text-gray-600">{t('noResults')}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {visible.map((product) => {
            const photo =
              product.images.find((image) => image.is_thumbnail)?.image_url ?? product.images[0]?.image_url;
            return (
              <li key={product.id} className="flex gap-3 rounded-lg border-2 border-black p-3">
                {photo ? (
                  <img src={photo} alt="" className="h-16 w-16 shrink-0 rounded-md object-cover" />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-gray-100">
                    <Package className="h-6 w-6 text-gray-400" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-black">{product.name}</p>
                  <p className="truncate text-sm text-gray-600">
                    {[product.brand, product.category].filter(Boolean).join(' · ') || product.unit}
                  </p>
                  <p className="mt-1 text-sm font-medium text-black">{formatCents(product.price_cents)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
