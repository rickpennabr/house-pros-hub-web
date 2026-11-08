'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createPortal } from 'react-dom';
import { MoreVertical, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { AdminDataTable, type AdminDataTableColumn } from '@/components/admin/AdminDataTable';
import { CatalogDeleteDialog } from '@/components/crm/catalog/catalog-delete-dialog';
import { ProductEditor } from '@/components/crm/catalog/product-editor';
import { formatCents } from '@/lib/crm/catalog-options';
import type { CrmCatalogTerm, CrmProduct } from '@/lib/crm/catalog-types';

const COLUMNS: AdminDataTableColumn<CrmProduct>[] = [
  { id: 'photo', label: 'Photo', width: 80, resizable: false },
  { id: 'name', label: 'Name', width: 180 },
  { id: 'brand', label: 'Brand', width: 140 },
  { id: 'sku', label: 'SKU', width: 120 },
  { id: 'category', label: 'Category', width: 140 },
  { id: 'unit', label: 'Sold by', width: 100 },
  { id: 'price', label: 'Price', width: 110 },
  { id: 'specs', label: 'Specs', width: 90 },
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
    case 'unit':
      return product.unit;
    case 'price':
      return formatCents(product.price_cents);
    case 'specs':
      return String(product.specs.length);
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
          <h1 className="text-xl font-semibold text-gray-900 md:text-2xl">Products</h1>
          <p className="mt-0.5 text-sm text-gray-500">Materials you sell or quote. Specifications change by category, so pavers and plants can share this list.</p>
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
      <AdminDataTable
        clientSide
        columnOrderKey="crm-products"
        exportName="products"
        columns={COLUMNS}
        data={products}
        total={products.length}
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
            return photo ? <img src={photo} alt="" className="h-10 w-10 rounded object-cover" /> : <span className="inline-block h-10 w-10 rounded bg-neutral-100" />;
          }
          if (columnId === 'specs') return String(row.specs.length);
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
              setMenuPosition({ top: rect.bottom + 4, left: Math.min(rect.right - 140, window.innerWidth - 150) });
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
