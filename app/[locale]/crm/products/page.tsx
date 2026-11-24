'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createPortal } from 'react-dom';
import { MoreVertical, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { AdminDataTable, type AdminDataTableColumn } from '@/components/admin/AdminDataTable';
import { CatalogDeleteDialog } from '@/components/crm/catalog/catalog-delete-dialog';
import { ProductEditor } from '@/components/crm/catalog/product-editor';
import { formatCents } from '@/lib/crm/catalog-options';
import type { CrmCatalogTerm, CrmProduct } from '@/lib/crm/catalog-types';
import { useTranslations } from 'next-intl';
import { TRADES, isTradeSlug } from '@/lib/protrades/trades';
import { useProTrades } from '@/hooks/useProTrades';
import { TitleCount } from '@/components/crm/TitleCount';

const ACTIONS_MENU_HEIGHT = 132;

const COLUMNS: AdminDataTableColumn<CrmProduct>[] = [
  { id: 'photo', label: 'Photo', width: 80, resizable: false },
  { id: 'name', label: 'Name', width: 180 },
  { id: 'brand', label: 'Brand', width: 140 },
  { id: 'sku', label: 'SKU', width: 120 },
  { id: 'category', label: 'Category', width: 140 },
  { id: 'trade', label: 'Trade', width: 120 },
  { id: 'unit', label: 'Sold by', width: 100 },
  { id: 'price', label: 'Price', width: 110 },
  { id: 'specs', label: 'Specs', width: 90 },
  { id: 'on_page', label: 'On details', width: 110 },
  { id: 'actions', label: 'Actions', resizable: false },
];

function cellText(product: CrmProduct, columnId: string): string {
  switch (columnId) {
    case 'name':
      return product.name;
    case 'brand':
      return product.brand;
    case 'sku':
      return product.sku ?? '';
    case 'category':
      return product.category ?? '';
    case 'trade':
      return product.trade ?? '';
    case 'unit':
      return product.unit;
    case 'price':
      return formatCents(product.price_cents);
    case 'specs':
      return String(product.specs.length);
    case 'on_page':
      return product.show_on_profile ? 'On' : 'Off';
    default:
      return '';
  }
}

function copyName(baseName: string, existing: CrmProduct[]): string {
  const names = new Set(existing.map((product) => product.name.trim().toLowerCase()));
  const plain = `${baseName} (Copy)`;
  if (!names.has(plain.toLowerCase())) return plain;
  let index = 2;
  while (index < 500) {
    const numbered = `${baseName} (Copy ${index})`;
    if (!names.has(numbered.toLowerCase())) return numbered;
    index += 1;
  }
  return `${baseName} (Copy ${Date.now()})`;
}

export default function CRMProductsPage() {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<CrmProduct[]>([]);
  const [terms, setTerms] = useState<CrmCatalogTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<CrmProduct | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CrmProduct | null>(null);
  const [bulkIds, setBulkIds] = useState<string[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const tTrades = useTranslations('protrades');
  const { state: proTrades } = useProTrades();
  /** '' = all, 'general' = no trade, or a trade slug. */
  const [tradeFilter, setTradeFilter] = useState('');
  // Trades with products, plus trades that are on (so the filter shows up as soon as a trade is on).
  const tradeOptions = useMemo(() => {
    const set = new Set<string>(proTrades?.active ?? []);
    for (const product of products) if (product.trade) set.add(product.trade);
    return [...set].filter(isTradeSlug);
  }, [products, proTrades]);
  const shownProducts = useMemo(
    () =>
      tradeFilter === ''
        ? products
        : tradeFilter === 'general'
          ? products.filter((product) => !product.trade)
          : products.filter((product) => product.trade === tradeFilter),
    [products, tradeFilter]
  );

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [productResponse, termResponse] = await Promise.all([
        fetch('/api/crm/products', { credentials: 'include' }),
        fetch('/api/crm/catalog-terms', { credentials: 'include' }),
      ]);
      const productData = await productResponse.json().catch(() => ({}));
      const termData = await termResponse.json().catch(() => ({}));
      if (!productResponse.ok) throw new Error(productData.error || 'Failed to load products');
      setProducts(productData.products ?? []);
      if (termResponse.ok) setTerms(termData.terms ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (searchParams.get('new') !== '1') return;
    setEditing(null);
    setEditorOpen(true);
  }, [searchParams]);

  const duplicate = async (product: CrmProduct) => {
    setError(null);
    const response = await fetch('/api/crm/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        name: copyName(product.name, products),
        brand: product.brand,
        sku: product.sku ?? '',
        upc: product.upc ?? '',
        category: product.category ?? '',
        description: product.description ?? '',
        unit: product.unit,
        price_cents: product.price_cents,
        show_on_profile: false,
        images: product.images.map((image) => ({
          image_url: image.image_url,
          storage_path: image.storage_path,
          is_thumbnail: image.is_thumbnail,
        })),
        specs: product.specs.map((spec) => ({ name: spec.name, value: spec.value })),
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error || 'Failed to duplicate the product');
      return;
    }
    setProducts((current) => [...current, data.product as CrmProduct]);
  };

  const toggleShowOnProfile = async (product: CrmProduct) => {
    setError(null);
    const next = !product.show_on_profile;
    setProducts((current) =>
      current.map((row) => (row.id === product.id ? { ...row, show_on_profile: next } : row))
    );
    const response = await fetch(`/api/crm/products/${product.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ show_on_profile: next }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setProducts((current) =>
        current.map((row) => (row.id === product.id ? { ...row, show_on_profile: product.show_on_profile } : row))
      );
      setError(data.error || 'Could not update details visibility');
      return;
    }
    if (data.product) {
      setProducts((current) => current.map((row) => (row.id === product.id ? (data.product as CrmProduct) : row)));
    }
  };

  const removeIds = async (ids: string[]) => {
    setDeleting(true);
    setError(null);
    try {
      for (const id of ids) {
        const response = await fetch(`/api/crm/products/${id}`, { method: 'DELETE', credentials: 'include' });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Failed to delete the product');
      }
      setProducts((current) => current.filter((product) => !ids.includes(product.id)));
      setDeleteTarget(null);
      setBulkIds(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete the product');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 md:text-2xl inline-flex items-center gap-2">
                Products
                <TitleCount count={products.length} />
              </h1>
          <p className="mt-0.5 text-sm text-gray-500">Materials you sell or quote. Turn on &quot;On details&quot; to show a product on your public Products tab.</p>
        </div>
        <Button
          variant="primary"
          size="sm"
          className="flex shrink-0 items-center gap-2"
          onClick={() => {
            setEditing(null);
            setEditorOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          New product
        </Button>
      </div>
      {tradeOptions.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-3">
          {[
            { key: '', label: tTrades('filterAll'), cls: 'border-black', on: 'bg-black text-white' },
            { key: 'general', label: tTrades('filterGeneral'), cls: 'border-black', on: 'bg-black text-white' },
            ...tradeOptions.map((slug) => ({
              key: slug,
              label: tTrades(`trade_${slug}`),
              cls: TRADES[slug].color.border,
              on: `${TRADES[slug].color.solid} text-white`,
            })),
          ].map((option) => (
            <button
              key={option.key || 'all'}
              type="button"
              onClick={() => setTradeFilter(option.key)}
              className={`shrink-0 cursor-pointer whitespace-nowrap rounded-lg border-2 px-3 py-1 text-sm ${option.cls} ${tradeFilter === option.key ? option.on : 'bg-white text-black'}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
      <AdminDataTable
        clientSide
        columnOrderKey="crm-products"
        exportName="products"
        columns={COLUMNS}
        data={shownProducts}
        total={shownProducts.length}
        pageSize={25}
        isLoading={loading}
        hasLoadedOnce={!loading}
        error={error}
        getRowId={(row) => row.id}
        getCellText={(row, columnId) => {
          if (columnId === 'photo') return row.images[0]?.image_url ?? '';
          if (columnId !== 'specs') return cellText(row, columnId);
          return row.specs.map((spec) => `${spec.name} ${spec.value}`).join(' ');
        }}
        searchPlaceholder="Search name, brand, SKU, category, specs..."
        emptyMessage="No products yet. Add pavers, plants, or anything else you quote."
        itemLabel="products"
        primaryColumnId="name"
        onRowClick={(row) => {
          setEditing(row);
          setEditorOpen(true);
        }}
        renderCell={(row, columnId) => {
          if (columnId === 'photo') {
            const photo = row.images.find((image) => image.is_thumbnail)?.image_url ?? row.images[0]?.image_url;
            return photo ? <img src={photo} alt="" className="h-8 w-8 rounded object-cover" /> : <span className="inline-block h-8 w-8 rounded bg-neutral-100" />;
          }
          if (columnId === 'specs') return String(row.specs.length);
          if (columnId === 'trade') {
            if (!row.trade || !isTradeSlug(row.trade)) return <span className="text-gray-400">—</span>;
            const color = TRADES[row.trade].color;
            return (
              <span className={`inline-block rounded-md border px-2 py-0.5 text-xs font-medium ${color.border} ${color.soft} ${color.text}`}>
                {tTrades(`trade_${row.trade}`)}
              </span>
            );
          }
          if (columnId === 'on_page') {
            return (
              <button
                type="button"
                role="switch"
                aria-checked={row.show_on_profile}
                aria-label={`Show ${row.name} on details page`}
                title={row.show_on_profile ? 'Shown on your details page' : 'Hidden from your details page'}
                onClick={(event) => {
                  event.stopPropagation();
                  void toggleShowOnProfile(row);
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-black transition-colors ${
                  row.show_on_profile ? 'bg-black' : 'bg-white'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full transition-transform ${
                    row.show_on_profile ? 'translate-x-5 bg-white' : 'translate-x-0.5 bg-black'
                  }`}
                />
              </button>
            );
          }
          return cellText(row, columnId) || '—';
        }}
        renderActions={(row) => (
          <button
            type="button"
            className="cursor-pointer rounded p-1 text-gray-600 hover:bg-gray-200"
            aria-label="Actions"
            onClick={(event) => {
              event.stopPropagation();
              if (openActionsId === row.id) {
                setOpenActionsId(null);
                setMenuPosition(null);
                return;
              }
              const rect = event.currentTarget.getBoundingClientRect();
              const spaceBelow = window.innerHeight - rect.bottom - 4;
              const top = spaceBelow >= ACTIONS_MENU_HEIGHT ? rect.bottom + 4 : Math.max(8, rect.top - ACTIONS_MENU_HEIGHT - 4);
              setMenuPosition({ top, left: Math.max(8, Math.min(rect.right - 140, window.innerWidth - 150)) });
              setOpenActionsId(row.id);
            }}
          >
            <MoreVertical className="h-5 w-5" />
          </button>
        )}
        bulkActions={{
          onDelete: (ids) => setBulkIds(ids),
          onEdit: (row) => {
            setEditing(row);
            setEditorOpen(true);
          },
          onCopyAsJson: (rows) => {
            void navigator.clipboard.writeText(JSON.stringify(rows, null, 2));
          },
        }}
      />

      <ProductEditor
        open={editorOpen}
        initial={editing}
        terms={terms}
        onClose={() => {
          setEditorOpen(false);
          setEditing(null);
        }}
        onTermsChange={setTerms}
        onSaved={(product) => {
          setProducts((current) => {
            const index = current.findIndex((row) => row.id === product.id);
            if (index === -1) return [...current, product];
            const next = [...current];
            next[index] = product;
            return next;
          });
        }}
      />

      {openActionsId && menuPosition
        ? createPortal(
            <div className="fixed z-[100] min-w-[140px] rounded-md border border-gray-200 bg-white py-1 text-left shadow-lg" style={{ top: menuPosition.top, left: menuPosition.left }}>
              <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-100" onClick={() => { const row = products.find((product) => product.id === openActionsId); setOpenActionsId(null); if (row) { setEditing(row); setEditorOpen(true); } }}>Edit</button>
              <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-100" onClick={() => { const row = products.find((product) => product.id === openActionsId); setOpenActionsId(null); if (row) void duplicate(row); }}>Duplicate</button>
              <button type="button" className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-gray-100" onClick={() => { const row = products.find((product) => product.id === openActionsId); setOpenActionsId(null); if (row) setDeleteTarget(row); }}>Delete</button>
            </div>,
            document.body
          )
        : null}

      {deleteTarget ? (
        <CatalogDeleteDialog
          title="Delete product?"
          message={`This removes ${deleteTarget.name} from your products.`}
          confirmLabel="Delete"
          deleting={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void removeIds([deleteTarget.id])}
        />
      ) : null}
      {bulkIds && bulkIds.length > 0 ? (
        <CatalogDeleteDialog
          title="Delete products?"
          message={`Delete ${bulkIds.length} product${bulkIds.length === 1 ? '' : 's'}? This cannot be undone.`}
          confirmLabel={`Delete ${bulkIds.length}`}
          deleting={deleting}
          onCancel={() => setBulkIds(null)}
          onConfirm={() => void removeIds(bulkIds)}
        />
      ) : null}
    </div>
  );
}
