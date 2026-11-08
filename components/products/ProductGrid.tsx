'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronDown, Grid, List, Search, X } from 'lucide-react';
import { useCategory } from '@/contexts/CategoryContext';
import type { ProProduct } from '@/lib/products/types';

interface ProductGridProps {
  products: ProProduct[];
}

const PAGE_SIZE = 18;

export function ProductGrid({ products }: ProductGridProps) {
  const t = useTranslations('proProducts');
  const locale = useLocale();
  const { setIsSearchOpen } = useCategory();
  const [search, setSearch] = useState('');
  const [searchActive, setSearchActive] = useState(false);
  const [type, setType] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [page, setPage] = useState(1);

  useEffect(() => () => setIsSearchOpen(false), [setIsSearchOpen]);

  const activateSearch = () => {
    if (window.matchMedia('(max-width: 767px)').matches) {
      setSearchActive(true);
      setIsSearchOpen(true);
    }
  };

  const deactivateSearch = () => {
    setSearchActive(false);
    setIsSearchOpen(false);
  };

  const types = useMemo(
    () => Array.from(new Set(products.map((product) => product.product_type).filter(Boolean))).sort(),
    [products]
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((product) => {
      if (type && product.product_type !== type) return false;
      if (!query) return true;
      return [product.name, product.brand, product.product_type, product.description, ...product.specs.flatMap((spec) => [spec.name, spec.value]), ...product.variants.flatMap((variant) => [variant.color, variant.size])]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [products, search, type]);

  useEffect(() => {
    setPage(1);
  }, [search, type]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);

  return (
    <div className="flex flex-col gap-2">
      <div className="-mx-2 -mt-1 flex h-[60px] w-[calc(100%+1rem)] shrink-0 flex-row items-center gap-2 border-b-2 border-black p-1 md:-mx-4 md:-mt-2 md:w-[calc(100%+2rem)] md:px-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-1 top-1/2 h-4 w-4 -translate-y-1/2 text-red-500 md:left-3" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onFocus={activateSearch}
            onBlur={deactivateSearch}
            placeholder={t('search')}
            className={`h-10 w-full rounded-md border-2 border-red-500 bg-white pl-6 text-base text-black placeholder:text-gray-500 focus:border-red-600 focus:outline-none md:pl-8 md:pr-8 ${search ? 'pr-8' : 'pr-2'}`}
          />
          {search ? (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-gray-500 hover:text-black"
              aria-label={t('search')}
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <div className={`flex shrink-0 items-center gap-2 ${searchActive ? 'max-md:hidden' : ''}`}>
          <div className="relative h-10 w-max shrink-0 md:w-40">
            <span aria-hidden className="invisible inline-flex h-10 items-center whitespace-nowrap pl-1 pr-5 text-sm md:hidden">
              {type || t('allTypes')}
            </span>
            <select
              value={type}
              onChange={(event) => setType(event.target.value)}
              className="absolute inset-0 h-10 w-full cursor-pointer appearance-none rounded-md border-2 border-black bg-white pl-1 pr-5 text-sm text-black md:static md:w-40 md:appearance-auto md:px-2"
              aria-label={t('type')}
            >
              <option value="">{t('allTypes')}</option>
              {types.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-0.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-black md:hidden" />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-md border-2 border-black ${viewMode === 'list' ? 'bg-black text-white' : 'bg-white text-black hover:bg-gray-100'}`}
              aria-label={t('listView')}
              aria-pressed={viewMode === 'list'}
            >
              <List className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-md border-2 border-black ${viewMode === 'grid' ? 'bg-black text-white' : 'bg-white text-black hover:bg-gray-100'}`}
              aria-label={t('gridView')}
              aria-pressed={viewMode === 'grid'}
            >
              <Grid className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-700">{t('noMatch')}</p>
      ) : (
        <div className={viewMode === 'list' ? 'flex flex-col gap-2' : 'grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3'}>
          {visible.map((product) => (
            <ProductCard key={product.id} product={product} locale={locale} viewMode={viewMode} />
          ))}
        </div>
      )}

      {filtered.length > PAGE_SIZE ? (
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: pageCount }, (_, index) => index + 1).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setPage(item);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-md border-2 border-black text-sm font-semibold ${
                item === safePage ? 'bg-black text-white' : 'bg-white text-black hover:bg-gray-100'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      ) : null}

      <p className="text-center text-sm text-gray-600">
        {filtered.length === 0
          ? t('showing', { from: 0, to: 0, total: 0 })
          : t('showing', { from: start + 1, to: Math.min(start + PAGE_SIZE, filtered.length), total: filtered.length })}
      </p>
    </div>
  );
}

function brandColor(brand: string): string {
  const normalized = brand.toLowerCase();
  if (normalized.includes('belgard')) return '#1A3057';
  if (normalized.includes('keystone')) return '#005596';
  if (normalized.includes('las vegas') || normalized.includes('lvp')) return '#842B38';
  return '#000000';
}

function brandLogoSrc(brand: string): string {
  const normalized = brand.toLowerCase();
  if (normalized.includes('belgard')) return '/images/brands/belgard/Belgard_logo_symbol.png';
  if (normalized.includes('keystone')) return '/images/brands/keystone/keystone-logo_symbol.png';
  if (normalized.includes('las vegas') || normalized.includes('lvp')) return '/images/brands/lasvegaspaver/LasVegasPaver_logo_symbol.png';
  return '';
}

function BrandMark({ brand }: { brand: string }) {
  const logo = brandLogoSrc(brand);
  const color = brandColor(brand);
  return (
    <div
      className="flex h-6 w-6 shrink-0 rotate-45 items-center justify-center overflow-hidden border border-gray-200 bg-white"
      style={{ boxShadow: '0 0 8px rgba(0, 0, 0, 0.12)', marginTop: '-0.3em', marginBottom: '-0.3em' }}
      title={brand}
    >
      <div className="flex h-full w-full -rotate-45 items-center justify-center">
        {logo ? (
          <img src={logo} alt="" className="h-[70%] w-[70%] object-contain" />
        ) : (
          <span className="text-base font-bold" style={{ color }}>{brand.charAt(0)}</span>
        )}
      </div>
    </div>
  );
}

function ProductCard({
  product,
  locale,
  viewMode,
}: {
  product: ProProduct;
  locale: string;
  viewMode: 'grid' | 'list';
}) {
  const t = useTranslations('proProducts');
  const [imageFailed, setImageFailed] = useState(false);
  const variant = product.variants[0];
  const imageSrc = variant?.images[0] || product.image_url;
  const showImage = Boolean(imageSrc) && !imageFailed;
  const list = viewMode === 'list';
  const color = variant?.color ?? '';
  const size = variant?.size ?? '';
  const thick = variant?.thicknessMm ?? '';
  const thickIn = variant?.thicknessIn ?? '';
  const sqftLayer = variant?.sqftLayer ?? 0;
  const sqftPallet = variant?.sqftPallet ?? 0;

  return (
    <Link
      href={`/${locale}/proproducts/${product.slug}`}
      className={`group relative cursor-pointer overflow-hidden rounded-xl border border-black bg-white shadow-md transition-all duration-300 hover:scale-[1.01] ${
        list ? 'flex h-[120px] min-h-0 flex-row' : 'flex h-full min-h-0 flex-col'
      }`}
    >
      <div
        className={`relative flex items-center justify-center overflow-hidden bg-gray-100 ${
          list ? 'h-full w-[30%] shrink-0' : 'aspect-[2/1.5] max-h-[260px] w-full'
        }`}
      >
        {showImage ? (
          <img
            src={imageSrc ?? undefined}
            alt={product.name}
            className="absolute inset-0 h-full w-full rounded-t-xl object-cover object-center"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-1 px-2 text-center">
            <img src="/house-pros-hub-logo-simble-bot.png" alt="" className={`object-contain grayscale ${list ? 'h-8 w-12' : 'h-10 w-16'}`} />
            <span className={`font-bold text-gray-500 ${list ? 'text-[10px]' : 'text-sm'}`}>{t('imageComingSoon')}</span>
          </div>
        )}
      </div>

      <div className={`flex min-w-0 flex-1 flex-col pb-1 ${list ? 'pl-1' : ''}`}>
        <div className={`flex w-full items-center justify-between gap-1 ${list ? 'py-1 pr-3' : 'px-2 pb-1 pr-3 pt-2'}`}>
          <div className="flex min-w-0 flex-col justify-center">
            <h2 className={`truncate font-bold leading-tight text-black ${list ? 'text-[15px]' : 'text-lg md:text-base'}`} title={product.name}>
              {product.name}
            </h2>
            {product.brand ? (
              <span className="text-[11px] font-semibold md:text-[12px]" style={{ color: brandColor(product.brand) }}>
                {product.brand}
              </span>
            ) : null}
          </div>
          {product.brand ? (
            <div className="ml-2 flex shrink-0 items-center justify-center">
              <BrandMark brand={product.brand} />
            </div>
          ) : null}
        </div>
        <div className="h-2 w-full bg-gradient-to-b from-black/10 to-transparent" />
        <div className={`flex-1 ${list ? 'pr-2 pb-[2px]' : 'px-2'}`}>
          <table className={`w-full table-fixed border-collapse ${list ? 'max-w-full text-[11px]' : 'text-[12px]'}`}>
            <tbody>
              <tr className="border-b border-gray-200">
                <SpecLabel>{t('color')}</SpecLabel>
                <SpecValue title={color}>{color}</SpecValue>
                <SpecLabel>{t('size')}</SpecLabel>
                <SpecValue title={size}>{size}</SpecValue>
              </tr>
              <tr className="border-b border-gray-200">
                <SpecLabel>{t('thick')}</SpecLabel>
                <SpecValue title={thick}>{thick}</SpecValue>
                <SpecLabel>{t('thickIn')}</SpecLabel>
                <SpecValue title={thickIn}>{thickIn}</SpecValue>
              </tr>
              <tr>
                <SpecLabel>{t('sqftLayerCard')}</SpecLabel>
                <SpecValue title={String(sqftLayer)}>{sqftLayer}</SpecValue>
                <SpecLabel>{t('sqftPalletCard')}</SpecLabel>
                <SpecValue title={String(sqftPallet)}>{sqftPallet}</SpecValue>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </Link>
  );
}

function SpecLabel({ children }: { children: ReactNode }) {
  return (
    <td className="min-w-[70px] whitespace-nowrap border-r border-gray-200 px-0.5 py-0.5 text-left text-[11px] font-bold text-red-600 last:border-r-0">
      {children}
    </td>
  );
}

function SpecValue({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <td className="truncate border-r border-gray-200 px-0.5 py-0.5 text-center text-black last:border-r-0" title={title}>
      {children}
    </td>
  );
}
