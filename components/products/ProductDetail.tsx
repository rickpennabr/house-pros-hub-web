'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Package } from 'lucide-react';
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
  const locale = useLocale();
  const [imageFailed, setImageFailed] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [openSection, setOpenSection] = useState<'data' | 'desc' | null>('data');
  const images = product.images.length > 0 ? product.images : product.image_url ? [product.image_url] : [];
  const currentImage = images[imageIndex] ?? images[0] ?? null;
  const showImage = Boolean(currentImage) && !imageFailed;

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightboxOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightboxOpen]);

  const rows = [
    { label: t('brand'), value: product.brand || '—' },
    { label: t('type'), value: product.product_type || '—' },
  ];

  return (
    <div className="flex flex-col gap-2 p-1 md:p-2">
      <Link href={`/${locale}/proproducts`} className="inline-flex items-center text-sm font-semibold text-black hover:underline">
        <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {t('back')}
      </Link>

      <div className="overflow-hidden rounded-lg border-2 border-black bg-white">
        <div className="flex flex-col md:h-[500px] md:flex-row">
          <div className="relative h-[220px] w-full bg-neutral-100 md:h-full md:w-[45%] md:min-w-[45%]">
            {showImage ? (
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                className="absolute inset-0 cursor-zoom-in"
                aria-label={product.name}
              >
                <img
                  src={currentImage ?? undefined}
                  alt=""
                  className="h-full w-full object-contain"
                  onError={() => setImageFailed(true)}
                />
              </button>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-neutral-400">
                <Package className="h-16 w-16" aria-hidden />
              </div>
            )}
            {images.length > 1 ? (
              <div className="absolute inset-x-2 bottom-2 flex gap-1 overflow-x-auto">
                {images.map((image, index) => (
                  <button
                    key={image}
                    type="button"
                    onClick={() => {
                      setImageFailed(false);
                      setImageIndex(index);
                    }}
                    className={`h-10 w-10 shrink-0 overflow-hidden rounded border-2 bg-white ${
                      index === imageIndex ? 'border-black' : 'border-white'
                    }`}
                  >
                    <img src={image} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex min-h-0 w-full flex-col md:w-[55%]">
            <div className="px-3 pb-2 pt-3 md:px-5 md:pt-5">
              <h1 className="truncate text-xl font-bold leading-tight text-black md:text-2xl">{product.name}</h1>
              {product.brand ? <p className="mt-0.5 truncate text-base font-semibold text-red-600">{product.brand}</p> : null}
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-3">
              <Accordion
                title={t('productData')}
                open={openSection === 'data'}
                onClick={() => setOpenSection(openSection === 'data' ? null : 'data')}
              >
                <table className="w-full border-collapse">
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.label} className="border-b border-gray-200 last:border-b-0">
                        <td className="w-[40%] py-1.5 pr-4 text-xs font-medium text-red-600 md:text-sm">{row.label}</td>
                        <td className="py-1.5 text-xs text-black md:text-sm">{row.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Accordion>
              <Accordion
                title={t('description')}
                open={openSection === 'desc'}
                onClick={() => setOpenSection(openSection === 'desc' ? null : 'desc')}
              >
                <p className="whitespace-pre-wrap text-xs leading-relaxed text-gray-700 md:text-sm">
                  {product.description || t('noDescription')}
                </p>
              </Accordion>
            </div>
          </div>
        </div>
      </div>

      {product.variants.length > 0 ? (
        <div className="overflow-hidden rounded-lg border-2 border-black bg-white">
          <h2 className="border-b-2 border-black bg-black px-3 py-2 text-sm font-semibold text-white">{t('variations')}</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-semibold text-red-600">
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

      {lightboxOpen && showImage
        ? createPortal(
            <div
              className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 p-4"
              onClick={() => setLightboxOpen(false)}
              role="presentation"
            >
              <button type="button" className="sr-only" onClick={() => setLightboxOpen(false)}>
                {t('closeImage')}
              </button>
              <img
                src={currentImage ?? undefined}
                alt={product.name}
                className="max-h-[90vh] max-w-full object-contain"
              />
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

function Accordion({
  title,
  open,
  onClick,
  children,
}: {
  title: string;
  open: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <div className="w-full">
      <button
        type="button"
        onClick={onClick}
        className={`flex h-12 w-full cursor-pointer items-center justify-between border-2 border-black bg-black px-3 font-medium text-white md:px-4 ${
          open ? 'rounded-t-lg' : 'rounded-lg'
        }`}
      >
        <span>{title}</span>
        <span className="relative h-5 w-5" aria-hidden>
          <span className={`absolute left-0 right-0 h-0.5 rounded bg-white transition-all duration-200 ${open ? 'top-2.5 rotate-45' : 'top-1.5'}`} />
          <span className={`absolute left-0 right-0 h-0.5 rounded bg-white transition-all duration-200 ${open ? 'top-2.5 -rotate-45' : 'top-3.5'}`} />
        </span>
      </button>
      {open ? <div className="rounded-b-lg border-2 border-t-0 border-black bg-white p-2 md:p-3">{children}</div> : null}
    </div>
  );
}
