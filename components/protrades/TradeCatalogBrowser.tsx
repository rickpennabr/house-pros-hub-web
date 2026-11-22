'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Check, Loader2, Plus, ScanSearch } from 'lucide-react';
import { HardscapeIcon, PlantsIcon } from '@/components/icons/hub';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { CRMSearchField } from '@/components/crm/CRMSearchField';
import { PlantIdentifierModal } from '@/components/ai/PlantIdentifierModal';
import { KindIcon } from '@/components/protrades/KindIcon';
import { TRADES, type TradeSlug } from '@/lib/protrades/trades';

interface CatalogItem {
  id: string;
  trade: string;
  kind: string;
  name: string;
  brand: string;
  scientific_name: string | null;
  category: string | null;
  description: string | null;
  image_url: string | null;
  unit: string;
  typical_price_cents: number | null;
  specs: { name: string; value: string }[] | null;
  added: boolean;
}

const PAGE_SIZE = 48;

/** Browse a trade's hub database and copy items into the pro's products. */
export function TradeCatalogBrowser({ trade }: { trade: TradeSlug }) {
  const t = useTranslations('protrades');
  const locale = useLocale();
  const kinds = TRADES[trade].kinds;
  const color = TRADES[trade].color;
  const [kind, setKind] = useState<string>(kinds.length === 1 ? kinds[0].slug : '');
  const [category, setCategory] = useState('');
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<CatalogItem | null>(null);
  const [price, setPrice] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [identifyOpen, setIdentifyOpen] = useState(false);
  const request = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const load = useCallback(async () => {
    const id = ++request.current;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ trade, page: String(page) });
    if (kind) params.set('kind', kind);
    if (category) params.set('category', category);
    if (debounced.trim()) params.set('q', debounced.trim());
    try {
      const res = await fetch(`/api/crm/protrades/catalog?${params}`, { credentials: 'include' });
      const data = await res.json();
      if (id !== request.current) return;
      if (!res.ok) throw new Error(data.error || t('loadFailed'));
      setItems(data.items ?? []);
      setCategories(data.categories ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      if (id === request.current) setError(err instanceof Error ? err.message : t('loadFailed'));
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, [trade, kind, category, debounced, page, t]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const openItem = (item: CatalogItem) => {
    setOpen(item);
    setPrice(item.typical_price_cents ? (item.typical_price_cents / 100).toFixed(2) : '');
    setAddError(null);
  };

  const add = async () => {
    if (!open) return;
    setAdding(true);
    setAddError(null);
    try {
      const cents = Math.round((Number.parseFloat(price) || 0) * 100);
      const res = await fetch('/api/crm/protrades/catalog/add', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: open.id, trade, ...(price ? { priceCents: cents } : {}) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t('addFailed'));
      setItems((current) => current.map((item) => (item.id === open.id ? { ...item, added: true } : item)));
      setOpen((current) => (current ? { ...current, added: true } : current));
    } catch (err) {
      setAddError(err instanceof Error ? err.message : t('addFailed'));
    } finally {
      setAdding(false);
    }
  };

  const Icon = trade === 'landscape' ? PlantsIcon : HardscapeIcon;
  const chip = (active: boolean) =>
    `cursor-pointer whitespace-nowrap rounded-lg border-2 px-3 py-1 text-sm ${color.border} ${active ? `${color.solid} text-white` : 'bg-white text-black hover:bg-gray-50'}`;
  // Type chips carry an icon that moves on hover (group).
  const kindChip = (active: boolean) => `group inline-flex items-center gap-1.5 ${chip(active)}`;
  const kindIcon = (active: boolean) => `h-4 w-4 shrink-0 ${active ? 'text-white' : color.text}`;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900 md:text-2xl">
          <span className={`flex h-9 w-9 items-center justify-center rounded-lg border-2 ${color.border} ${color.soft}`}>
            <Icon className={`h-5 w-5 ${color.text}`} />
          </span>
          {t(`db_${trade}`)}
        </h1>
        <p className="text-sm text-gray-600">{t(`dbIntro_${trade}`)}</p>
      </div>

      <CRMSearchField
        value={query}
        onChange={(value) => {
          setQuery(value);
          setPage(1);
        }}
        placeholder={t(`search_${trade}`)}
      />
      {trade === 'landscape' ? (
        <div className="flex justify-end">
          <Button type="button" variant="secondary" onClick={() => setIdentifyOpen(true)}>
            <ScanSearch className="mr-2 h-4 w-4" />
            {t('identifyFromPhoto')}
          </Button>
        </div>
      ) : null}

      {kinds.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button type="button" className={kindChip(!kind)} onClick={() => { setKind(''); setCategory(''); setPage(1); }}>
            <KindIcon kind="" className={kindIcon(!kind)} />
            {t('all')}
          </button>
          {kinds.map((row) => (
            <button key={row.slug} type="button" className={kindChip(kind === row.slug)} onClick={() => { setKind(row.slug); setCategory(''); setPage(1); }}>
              <KindIcon kind={row.slug} className={kindIcon(kind === row.slug)} />
              {t(`kind_${row.slug}`)}
            </button>
          ))}
        </div>
      ) : null}
      {categories.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button type="button" className={chip(!category)} onClick={() => { setCategory(''); setPage(1); }}>
            {t('allCategories')}
          </button>
          {categories.map((name) => (
            <button key={name} type="button" className={chip(category === name)} onClick={() => { setCategory(name); setPage(1); }}>
              {name}
            </button>
          ))}
        </div>
      ) : null}

      {error ? <p className="rounded-lg border-2 border-red-600 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {loading ? (
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      ) : items.length === 0 && !error ? (
        <p className="py-8 text-center text-sm text-gray-500">{t('noResults')}</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => openItem(item)}
              className="group flex cursor-pointer gap-3 rounded-lg border-2 border-black bg-white p-3 text-left hover:bg-gray-50"
            >
              <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-black/15 bg-gray-50">
                {item.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- hub catalog photo
                  <img src={item.image_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <KindIcon kind={item.kind} className={`h-7 w-7 ${color.text} opacity-60`} />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{item.name}</span>
                <span className="block truncate text-xs text-gray-600">
                  {item.scientific_name ? <i>{item.scientific_name}</i> : item.brand || t(`kind_${item.kind}`)}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-1">
                  {item.category ? <span className="rounded-md border border-gray-300 px-1.5 py-0.5 text-[11px] text-gray-700">{item.category}</span> : null}
                  {item.added ? (
                    <span className="inline-flex items-center gap-0.5 rounded-md border border-green-700 bg-green-50 px-1.5 py-0.5 text-[11px] text-green-800">
                      <Check className="h-3 w-3" />
                      {t('inMyProducts')}
                    </span>
                  ) : null}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {pages > 1 ? (
        <div className="flex items-center justify-center gap-3 text-sm">
          <Button type="button" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            {t('prev')}
          </Button>
          <span>{t('pageOf', { page, pages })}</span>
          <Button type="button" variant="secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            {t('next')}
          </Button>
        </div>
      ) : null}

      {open ? (
        <Modal isOpen onClose={() => setOpen(null)} title={open.name} showHeader showCloseButton maxWidth="lg">
          <div className="space-y-4">
            <div className="flex gap-4">
              <span className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 border-black bg-gray-50">
                {open.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- hub catalog photo
                  <img src={open.image_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <KindIcon kind={open.kind} className="h-10 w-10 text-gray-400" />
                )}
              </span>
              <div className="min-w-0 space-y-1">
                {open.scientific_name ? <p className="italic text-gray-700">{open.scientific_name}</p> : null}
                {open.brand ? <p className="text-sm font-semibold">{open.brand}</p> : null}
                <p className="text-xs text-gray-600">
                  {[t(`kind_${open.kind}`), open.category, t('soldBy', { unit: open.unit })].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>
            {open.description ? <p className="text-sm text-gray-800">{open.description}</p> : null}
            {open.specs && open.specs.length > 0 ? (
              <dl className="grid grid-cols-1 gap-2 rounded-lg border-2 border-black p-3 text-sm sm:grid-cols-2">
                {open.specs.map((spec) => (
                  <div key={spec.name}>
                    <dt className="text-xs font-semibold uppercase text-gray-500">{spec.name}</dt>
                    <dd>{spec.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {open.added ? (
              <p className="flex items-center gap-2 text-sm font-semibold text-green-700">
                <Check className="h-4 w-4" />
                {t('addedNote')}{' '}
                <Link href={`/${locale}/crm/products`} className="underline">
                  {t('openProducts')}
                </Link>
              </p>
            ) : (
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-gray-600">{t('yourPrice', { unit: open.unit })}</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-36 rounded-lg border-2 border-black px-3 py-2 text-sm"
                  />
                </div>
                <Button type="button" onClick={() => void add()} disabled={adding}>
                  {adding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  {t('addToProducts')}
                </Button>
              </div>
            )}
            {addError ? <p className="text-sm text-red-600">{addError}</p> : null}
          </div>
        </Modal>
      ) : null}

      {trade === 'landscape' ? (
        <PlantIdentifierModal
          isOpen={identifyOpen}
          onClose={() => setIdentifyOpen(false)}
          useLabel={t('findInDatabase')}
          onUse={(result) => {
            setIdentifyOpen(false);
            // Genus matches more of the database than a full species name.
            const genus = result.scientificName.split(/\s+/)[0] ?? '';
            setQuery(genus.length > 2 ? genus : result.commonName);
            setCategory('');
            setPage(1);
          }}
        />
      ) : null}
    </div>
  );
}
