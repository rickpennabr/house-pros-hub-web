'use client';

import { Package, PackageOpen } from 'lucide-react';
import { useTranslations } from 'next-intl';
import BusinessDetailsHeader from '@/components/businessdetails/BusinessDetailsHeader';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { ImageSlides } from '@/components/media/ImageSlides';
import type { ProProduct, ProductVariant } from '@/lib/products/types';

interface ProductDetailProps {
  product: ProProduct;
}

function thicknessLabel(variant: ProductVariant) {
  if (variant.thicknessMm && variant.thicknessIn && variant.thicknessMm !== variant.thicknessIn) {
    return `${variant.thicknessMm} mm / ${variant.thicknessIn} in`;
  }
  return variant.thicknessIn || variant.thicknessMm || '—';
}

export function ProductDetail({ product }: ProductDetailProps) {
  const t = useTranslations('proProducts');
  const images = product.images.length > 0 ? product.images : product.image_url ? [product.image_url] : [];
  const slides = images.map((src) => ({ src, alt: product.name }));
  const specs = [
    product.brand ? { label: t('brand'), value: product.brand } : null,
    product.product_type ? { label: t('type'), value: product.product_type } : null,
    ...product.specs.map((spec) => ({ label: spec.name, value: spec.value })),
  ].filter((row): row is { label: string; value: string } => Boolean(row));

  return (
    <div className="flex flex-col">
      <BusinessDetailsHeader
        businessName={t('title')}
        subtitle={t('detailsTitle')}
        shareTitle={t('shareTitle')}
      />

      <div className="flex flex-col gap-3 p-2 md:p-4">
        <Breadcrumb
          className="mb-0 pb-0"
          items={[
            { label: t('title'), href: '/proproducts', icon: Package },
            ...(product.product_type
              ? [{ label: product.product_type, href: '/proproducts', icon: PackageOpen }]
              : []),
            { label: product.name },
          ]}
        />

        <div className="overflow-hidden rounded-lg border-2 border-black bg-white">
          <div className="flex flex-col md:flex-row md:items-start">
            <div className="w-full bg-neutral-100 p-2 md:w-1/2 md:p-3">
              {slides.length > 0 ? (
                <ImageSlides images={slides} label={product.name} />
              ) : (
                <div className="flex aspect-square w-full items-center justify-center rounded-lg border-2 border-black bg-white text-neutral-400">
                  <Package className="h-16 w-16" aria-hidden />
                  <span className="sr-only">{t('noPhoto')}</span>
                </div>
              )}
            </div>

            <div className="flex w-full flex-col gap-3 p-3 md:w-1/2 md:p-5">
              {product.product_type ? (
                <p className="text-sm font-medium text-gray-500">{product.product_type}</p>
              ) : null}
              <h2 className="text-xl font-bold leading-tight text-black md:text-2xl">{product.name}</h2>
              {product.brand ? <p className="text-sm text-gray-600">{product.brand}</p> : null}
              {product.description ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">{product.description}</p>
              ) : (
                <p className="text-sm text-gray-500">{t('noDescription')}</p>
              )}
              {specs.length > 0 ? (
                <dl className="space-y-1.5 border-t border-gray-200 pt-3">
                  {specs.map((row) => (
                    <div key={row.label} className="flex gap-3 text-sm">
                      <dt className="w-28 shrink-0 font-medium text-gray-500">{row.label}</dt>
                      <dd className="text-black">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              {product.variants.length > 0 ? (
                <p className="text-sm font-medium text-gray-700">
                  {t('variantCount', { count: product.variants.length })}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        {product.variants.length > 0 ? (
          <div className="overflow-hidden rounded-lg border-2 border-black bg-white">
            <h2 className="border-b-2 border-black bg-black px-3 py-2 text-sm font-semibold text-white">
              {t('variations')}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs font-semibold text-gray-600">
                    <th className="px-3 py-2">{t('color')}</th>
                    <th className="px-3 py-2">{t('size')}</th>
                    <th className="px-3 py-2">{t('thickness')}</th>
                    <th className="px-3 py-2">{t('sqftPallet')}</th>
                    <th className="px-3 py-2">{t('sqftLayer')}</th>
                    <th className="px-3 py-2">{t('layersPallet')}</th>
                    <th className="px-3 py-2">{t('pcsPallet')}</th>
                  </tr>
                </thead>
                <tbody>
                  {product.variants.map((variant) => (
                    <tr key={variant.id} className="border-b border-gray-200 last:border-b-0">
                      <td className="px-3 py-2 text-black">{variant.color || '—'}</td>
                      <td className="px-3 py-2 text-black">{variant.size || '—'}</td>
                      <td className="px-3 py-2 text-black">{thicknessLabel(variant)}</td>
                      <td className="px-3 py-2 text-black">{variant.sqftPallet}</td>
                      <td className="px-3 py-2 text-black">{variant.sqftLayer}</td>
                      <td className="px-3 py-2 text-black">{variant.layerPallet}</td>
                      <td className="px-3 py-2 text-black">{variant.pcsPallet}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
