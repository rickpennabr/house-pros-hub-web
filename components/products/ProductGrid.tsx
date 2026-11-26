'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Filter } from 'lucide-react';
import { TypingSearchInput } from '@/components/common/TypingSearchInput';
import ViewToggle, { type ViewType } from '@/components/pageslayout/ViewToggle';
import Modal from '@/components/ui/Modal';
import { useCategory } from '@/contexts/CategoryContext';
import {
  PRODUCT_TRADES,
  hardscapeFilterOptions,
  productMatchesHardscapeFilters,
  productTrade,
  showsHardscapeFilters,
} from '@/lib/products/tradeFilters';
import type { ProProduct } from '@/lib/products/types';
import { brandLogoSrc } from '@/lib/products/brand-logos';

interface ProductGridProps {
  products: ProProduct[];
}

const PAGE_SIZE = 18;

const EMPTY_HARDSCAPE_FILTERS = {
  brand: '',
  type: '',
  thickness: '',
  color: '',
};

export function ProductGrid({ products }: ProductGridProps) {
  const t = useTranslations('proProducts');
  const locale = useLocale();
  const { setIsSearchOpen } = useCategory();
  const [search, setSearch] = useState('');
  const [searchActive, setSearchActive] = useState(false);
  const [trade, setTrade] = useState('');
  const [brand, setBrand] = useState('');
  const [type, setType] = useState('');
  const [thickness, setThickness] = useState('');
  const [color, setColor] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [page, setPage] = useState(1);

  const handleViewChange = (view: ViewType) => {
    setViewMode(view === 'list' ? 'list' : 'grid');
  };

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

  const hardscapeActive = showsHardscapeFilters(trade);
  const options = useMemo(() => hardscapeFilterOptions(products), [products]);
  const activeFilterCount =
    (trade ? 1 : 0) +
    (hardscapeActive && brand ? 1 : 0) +
    (hardscapeActive && type ? 1 : 0) +
    (hardscapeActive && thickness ? 1 : 0) +
    (hardscapeActive && color ? 1 : 0);

  const clearAttributeFilters = () => {
    setBrand(EMPTY_HARDSCAPE_FILTERS.brand);
    setType(EMPTY_HARDSCAPE_FILTERS.type);
    setThickness(EMPTY_HARDSCAPE_FILTERS.thickness);
    setColor(EMPTY_HARDSCAPE_FILTERS.color);
  };

  const clearAllFilters = () => {
    setTrade('');
    clearAttributeFilters();
  };

  const onTradeChange = (value: string) => {
    setTrade(value);
    if (!showsHardscapeFilters(value)) clearAttributeFilters();
  };

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const hardscapeFilters = { brand, type, thickness, color };
    return products.filter((product) => {
      if (trade && productTrade(product) !== trade) return false;
      if (hardscapeActive && !productMatchesHardscapeFilters(product, hardscapeFilters)) return false;
      if (!query) return true;
      return [
        product.name,
        product.brand,
        product.product_type,
        product.description,
        ...product.specs.flatMap((spec) => [spec.name, spec.value]),
        ...product.variants.flatMap((variant) => [variant.color, variant.size, variant.thicknessMm, variant.thicknessIn]),
      ]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [products, search, trade, brand, type, thickness, color, hardscapeActive]);

  useEffect(() => {
    setPage(1);
  }, [search, trade, brand, type, thickness, color]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);
  const searchPlaceholder = hardscapeActive ? t('searchHardscape') : t('search');

  const tradeSelect = (
    <FilterSelect
      label={t('trade')}
      value={trade}
      onChange={onTradeChange}
      allLabel={t('allTrades')}
      options={PRODUCT_TRADES.map((item) => ({
        value: item,
        label: t(`trades.${item}` as 'trades.hardscape'),
      }))}
    />
  );

  const hardscapeSelects = hardscapeActive ? (
    <>
      <FilterSelect label={t('brand')} value={brand} onChange={setBrand} allLabel={t('allBrands')} options={options.brand} />
      <FilterSelect label={t('type')} value={type} onChange={setType} allLabel={t('allTypes')} options={options.type} />
      <FilterSelect
        label={t('thickness')}
        value={thickness}
        onChange={setThickness}
        allLabel={t('allThicknesses')}
        options={options.thickness}
      />
      <FilterSelect label={t('color')} value={color} onChange={setColor} allLabel={t('allColors')} options={options.color} />
    </>
  ) : null;

  return (
    <div className="flex flex-col gap-2">
      <div className="-mx-1 -mt-1 flex w-[calc(100%+0.5rem)] shrink-0 flex-col gap-2 border-b-2 border-black p-1 md:-mx-2 md:-mt-2 md:w-[calc(100%+1rem)] md:px-2">
        <div className="flex h-10 flex-row items-center gap-2 md:h-[52px]">
          <TypingSearchInput
            value={search}
            onChange={setSearch}
            placeholder={searchPlaceholder}
            clearLabel={t('clearSearch')}
            onFocus={activateSearch}
            onBlur={deactivateSearch}
            iconClassName="pointer-events-none absolute left-1 top-1/2 h-4 w-4 -translate-y-1/2 text-red-500 md:left-3"
            inputClassName={`h-10 w-full rounded-md border-2 border-red-500 bg-white pl-6 text-base text-black placeholder:text-gray-500 focus:border-red-600 focus:outline-none md:pl-8 md:pr-8 ${search ? 'pr-8' : 'pr-2'}`}
          />
          <div className="hidden w-44 shrink-0 md:block">{tradeSelect}</div>
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className={`relative flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-md border-2 border-black bg-black text-white hover:bg-gray-800 md:hidden ${searchActive ? 'max-md:hidden' : ''}`}
            aria-label={t('filter')}
          >
            <Filter className="h-5 w-5" />
            {activeFilterCount > 0 ? (
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500" aria-hidden />
            ) : null}
          </button>
        </div>

        {hardscapeActive ? (
          <div className="hidden grid-cols-4 gap-2 md:grid">{hardscapeSelects}</div>
        ) : null}
      </div>

      <Modal
        isOpen={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title={t('filtersTitle')}
        showHeader
        maxWidth="md"
        contentClassName="space-y-3 p-4"
      >
        {tradeSelect}
        {hardscapeSelects}
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={clearAllFilters}
            className="h-11 flex-1 cursor-pointer rounded-md border-2 border-black bg-white text-sm font-semibold text-black hover:bg-gray-100"
          >
            {t('clearFilters')}
          </button>
          <button
            type="button"
            onClick={() => setFiltersOpen(false)}
            className="h-11 flex-1 cursor-pointer rounded-md border-2 border-black bg-black text-sm font-semibold text-white hover:bg-gray-800"
          >
            {t('applyFilters')}
          </button>
        </div>
      </Modal>

      <div className="px-2 md:px-0">
        {visible.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-700">{t('noMatch')}</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            {visible.map((product) => (
              <ProductCard key={product.id} product={product} locale={locale} viewMode={viewMode} />
            ))}
          </div>
        )}

        {filtered.length > PAGE_SIZE ? (
          <div className="mt-2 flex items-center justify-center gap-2">
            {Array.from({ length: pageCount }, (_, index) => index + 1).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setPage(item);
                  const main = document.getElementById('main-content');
                  const card = main?.parentElement;
                  if (card && card.scrollHeight > card.clientHeight) {
                    card.scrollTo({ top: 0, behavior: 'smooth' });
                  } else {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }
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

        <p className="mt-2 text-center text-sm text-gray-600">
          {filtered.length === 0
            ? t('showing', { from: 0, to: 0, total: 0 })
            : t('showing', { from: start + 1, to: Math.min(start + PAGE_SIZE, filtered.length), total: filtered.length })}
        </p>
      </div>

      <ViewToggle
        currentView={viewMode === 'list' ? 'list' : 'card'}
        onViewChange={handleViewChange}
        views={['card', 'list']}
        hideBackgroundToggle
      />
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  allLabel,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  allLabel: string;
  options: string[] | Array<{ value: string; label: string }>;
}) {
  const normalized = options.map((option) =>
    typeof option === 'string' ? { value: option, label: option } : option
  );

  return (
    <label className="flex min-w-0 w-full flex-col gap-1">
      <span className="text-xs font-semibold text-black md:sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full cursor-pointer rounded-md border-2 border-black bg-white px-2 text-sm text-black"
        aria-label={label}
      >
        <option value="">{value ? allLabel : label}</option>
        {normalized.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function brandColor(brand: string): string {
  const normalized = brand.toLowerCase();
  if (normalized.includes('belgard')) return '#1A3057';
  if (normalized.includes('keystone')) return '#005596';
  if (normalized.includes('las vegas') || normalized.includes('lvp')) return '#842B38';
  return '#000000';
}

function BrandMark({ brand, logoUrl }: { brand: string; logoUrl?: string | null }) {
  const logo = brandLogoSrc(brand, logoUrl);
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
  const imageSrc = product.image_url || variant?.images[0] || null;
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
              <BrandMark brand={product.brand} logoUrl={product.brand_logo} />
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
