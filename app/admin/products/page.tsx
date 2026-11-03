'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { AdminFloatingAddButton } from '@/components/admin/AdminFloatingAddButton';
import { AdminDataTable, type AdminDataTableColumn } from '@/components/admin/AdminDataTable';
import type { ProProduct } from '@/lib/products/types';

interface ProductFormState {
  name: string;
  brand: string;
  product_type: string;
  description: string;
  image_url: string;
}

interface VariantFormState {
  color: string;
  size: string;
  thickness_mm: string;
  thickness_in: string;
  sqft_pallet: string;
  sqft_layer: string;
  lnft_pallet: string;
  layer_pallet: string;
  pcs_pallet: string;
}

const emptyForm: ProductFormState = {
  name: '',
  brand: '',
  product_type: '',
  description: '',
  image_url: '',
};

const emptyVariant: VariantFormState = {
  color: '',
  size: '',
  thickness_mm: '',
  thickness_in: '',
  sqft_pallet: '0',
  sqft_layer: '0',
  lnft_pallet: '0',
  layer_pallet: '0',
  pcs_pallet: '0',
};

const fieldClass = 'mt-1 w-full rounded-lg border-2 border-black px-3 py-2 text-sm';
const MENU_HEIGHT = 80;

const PRODUCT_COLUMNS: AdminDataTableColumn<ProProduct>[] = [
  { id: 'photo', label: 'Photo', width: 80, resizable: false, wrap: true },
  { id: 'name', label: 'Name', width: 220 },
  { id: 'brand', label: 'Brand', width: 160 },
  { id: 'product_type', label: 'Type', width: 180 },
  { id: 'variations', label: 'Variations', width: 120 },
  { id: 'actions', label: 'Actions', resizable: false },
];

function productCellText(row: ProProduct, columnId: string): string {
  switch (columnId) {
    case 'photo':
      return row.image_url ?? '';
    case 'name':
      return row.name;
    case 'brand':
      return row.brand;
    case 'product_type':
      return row.product_type;
    case 'variations':
      return String(row.variants.length);
    default:
      return '';
  }
}

function productToForm(product: ProProduct): ProductFormState {
  return {
    name: product.name,
    brand: product.brand,
    product_type: product.product_type,
    description: product.description,
    image_url: product.image_url ?? '',
  };
}

function countValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<ProProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductFormState>(emptyForm);
  const [variantForm, setVariantForm] = useState<VariantFormState>(emptyVariant);
  const [deleteConfirm, setDeleteConfirm] = useState<{ ids: string[]; label: string } | null>(null);
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);
  const actionsButtonRef = useRef<HTMLButtonElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/products', { credentials: 'include', cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Failed to load products');
      setProducts(data.products ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!openActionsId) return;
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!actionsMenuRef.current?.contains(target) && !actionsButtonRef.current?.contains(target)) {
        setOpenActionsId(null);
        setMenuPosition(null);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [openActionsId]);

  const editing = products.find((product) => product.id === editingId) ?? null;

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setVariantForm(emptyVariant);
    setError(null);
    setEditorOpen(true);
  };

  const openEdit = (product: ProProduct) => {
    setEditingId(product.id);
    setForm(productToForm(product));
    setVariantForm(emptyVariant);
    setError(null);
    setEditorOpen(true);
  };

  const replaceProduct = (product: ProProduct | null | undefined) => {
    if (!product) return;
    setProducts((current) => current.map((item) => (item.id === product.id ? product : item)));
    setForm(productToForm(product));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(editingId ? `/api/admin/products/${editingId}` : '/api/admin/products', {
        method: editingId ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Failed to save product');
      if (!editingId && data.product?.id) {
        setEditingId(data.product.id);
        setProducts((current) => [...current, data.product]);
        setForm(productToForm(data.product));
      } else {
        replaceProduct(data.product);
        setEditorOpen(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const addVariant = async () => {
    if (!editingId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/products/${editingId}/variants`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          color: variantForm.color,
          size: variantForm.size,
          thickness_mm: variantForm.thickness_mm,
          thickness_in: variantForm.thickness_in,
          sqft_pallet: countValue(variantForm.sqft_pallet),
          sqft_layer: countValue(variantForm.sqft_layer),
          lnft_pallet: countValue(variantForm.lnft_pallet),
          layer_pallet: countValue(variantForm.layer_pallet),
          pcs_pallet: countValue(variantForm.pcs_pallet),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Failed to add variation');
      replaceProduct(data.product);
      setVariantForm(emptyVariant);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add variation');
    } finally {
      setSaving(false);
    }
  };

  const removeVariant = async (variantId: number) => {
    if (!editingId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/products/${editingId}/variants/${variantId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Failed to delete variation');
      replaceProduct(data.product);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete variation');
    } finally {
      setSaving(false);
    }
  };

  const requestDelete = (ids: string[]) => {
    const label =
      ids.length === 1
        ? (products.find((product) => product.id === ids[0])?.name ?? 'this product')
        : `${ids.length} products`;
    setDeleteConfirm({ ids, label });
  };

  const remove = async () => {
    if (!deleteConfirm) return;
    setSaving(true);
    setError(null);
    try {
      for (const id of deleteConfirm.ids) {
        const res = await fetch(`/api/admin/products/${id}`, { method: 'DELETE', credentials: 'include' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? 'Failed to delete product');
      }
      if (editingId && deleteConfirm.ids.includes(editingId)) setEditorOpen(false);
      setDeleteConfirm(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete product');
    } finally {
      setSaving(false);
    }
  };

  const uploadPhoto = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.set('file', file);
      const res = await fetch('/api/admin/products/image', { method: 'POST', credentials: 'include', body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Failed to upload the photo');
      setForm((current) => ({ ...current, image_url: data.image_url ?? '' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload the photo');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="flex flex-row items-center justify-between gap-4 pt-2 pb-2 md:pt-0 md:pb-0">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-semibold text-gray-900">Products</h1>
          <p className="mt-0.5 text-sm text-gray-500">House Pros catalog, including colors, sizes, and thicknesses.</p>
        </div>
        <Button variant="primary" size="sm" className="hidden md:flex items-center gap-2 shrink-0" onClick={openCreate}>
          <Plus className="w-4 h-4" />
          Add product
        </Button>
      </div>
      <AdminFloatingAddButton onClick={openCreate} ariaLabel="Add product" />

      <AdminDataTable
        clientSide
        columnOrderKey="admin-products"
        exportName="products"
        columns={PRODUCT_COLUMNS}
        data={products}
        total={products.length}
        pageSize={25}
        isLoading={loading}
        hasLoadedOnce={!loading}
        error={editorOpen ? null : error}
        getRowId={(row) => row.id}
        getCellText={productCellText}
        searchPlaceholder="Search products..."
        emptyMessage="No products yet."
        itemLabel="products"
        primaryColumnId="name"
        onRowClick={(row) => openEdit(row)}
        renderCell={(row, columnId) => {
          if (columnId === 'photo') {
            return row.image_url ? (
              <img src={row.image_url} alt="" className="h-10 w-10 rounded object-cover" />
            ) : (
              <span className="inline-block h-10 w-10 rounded bg-neutral-100" />
            );
          }
          if (columnId === 'name') return <span className="font-medium text-black">{row.name}</span>;
          if (columnId === 'variations') {
            const count = row.variants.length;
            return `${count} variation${count === 1 ? '' : 's'}`;
          }
          return productCellText(row, columnId) || '—';
        }}
        renderActions={(row) => (
          <button
            ref={openActionsId === row.id ? actionsButtonRef : undefined}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              if (openActionsId === row.id) {
                setOpenActionsId(null);
                setMenuPosition(null);
                return;
              }
              const rect = event.currentTarget.getBoundingClientRect();
              actionsButtonRef.current = event.currentTarget;
              const left = Math.min(rect.right - 120, window.innerWidth - 130);
              const spaceBelow = window.innerHeight - rect.bottom - 4;
              const top = spaceBelow >= MENU_HEIGHT ? rect.bottom + 4 : rect.top - MENU_HEIGHT - 4;
              setMenuPosition({ top, left });
              setOpenActionsId(row.id);
            }}
            className="p-1 rounded hover:bg-gray-200 transition-colors cursor-pointer text-gray-600 hover:text-black"
            aria-label="Actions"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
        )}
        bulkActions={{
          onDelete: requestDelete,
          onEdit: (row) => openEdit(row),
          onCopyAsJson: (rows) => {
            void navigator.clipboard.writeText(JSON.stringify(rows, null, 2));
          },
        }}
      />

      <Modal isOpen={editorOpen} onClose={() => setEditorOpen(false)} title={editingId ? 'Edit product' : 'Add product'} maxWidth="2xl">
        <div className="space-y-3">
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div>
            <span className="text-xs font-bold uppercase tracking-wide text-gray-600">Photo</span>
            <div className="mt-1 overflow-hidden rounded-lg border-2 border-black bg-neutral-100">
              {form.image_url ? (
                <img src={form.image_url} alt="" className="h-40 w-full object-cover" />
              ) : (
                <div className="flex h-40 items-center justify-center text-sm text-gray-500">No photo yet</div>
              )}
            </div>
            <label className="mt-2 inline-block cursor-pointer rounded-lg border-2 border-black px-3 py-2 text-sm font-bold">
              {uploading ? 'Uploading...' : form.image_url ? 'Replace photo' : 'Upload photo'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={uploading}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  void uploadPhoto(file);
                }}
              />
            </label>
          </div>
          <label className="block text-sm font-semibold">
            Name
            <input className={fieldClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-semibold">
              Brand
              <input className={fieldClass} value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} />
            </label>
            <label className="block text-sm font-semibold">
              Type
              <input
                className={fieldClass}
                value={form.product_type}
                onChange={(event) => setForm({ ...form, product_type: event.target.value })}
              />
            </label>
          </div>
          <label className="block text-sm font-semibold">
            Description
            <textarea
              className={`${fieldClass} min-h-28`}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </label>

          {editing ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold">Variations</p>
              {editing.variants.length === 0 ? <p className="text-sm text-gray-600">No variations yet.</p> : null}
              <ul className="max-h-40 space-y-1 overflow-y-auto">
                {editing.variants.map((variant) => (
                  <li key={variant.id} className="flex items-center justify-between gap-2 rounded border border-gray-200 px-2 py-1 text-sm">
                    <span className="min-w-0 truncate">
                      {[variant.color, variant.size, variant.thicknessIn ? `${variant.thicknessIn} in` : ''].filter(Boolean).join(' · ') || 'Variation'}
                    </span>
                    <button type="button" onClick={() => void removeVariant(variant.id)} className="shrink-0 text-xs font-bold text-red-600">
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
              <div className="grid gap-2 sm:grid-cols-2">
                <input className={fieldClass} placeholder="Color" value={variantForm.color} onChange={(event) => setVariantForm({ ...variantForm, color: event.target.value })} />
                <input className={fieldClass} placeholder="Size" value={variantForm.size} onChange={(event) => setVariantForm({ ...variantForm, size: event.target.value })} />
                <input className={fieldClass} placeholder="Thickness mm" value={variantForm.thickness_mm} onChange={(event) => setVariantForm({ ...variantForm, thickness_mm: event.target.value })} />
                <input className={fieldClass} placeholder="Thickness in" value={variantForm.thickness_in} onChange={(event) => setVariantForm({ ...variantForm, thickness_in: event.target.value })} />
                <input className={fieldClass} placeholder="Sq ft / pallet" value={variantForm.sqft_pallet} onChange={(event) => setVariantForm({ ...variantForm, sqft_pallet: event.target.value })} />
                <input className={fieldClass} placeholder="Pcs / pallet" value={variantForm.pcs_pallet} onChange={(event) => setVariantForm({ ...variantForm, pcs_pallet: event.target.value })} />
              </div>
              <button type="button" disabled={saving} onClick={() => void addVariant()} className="rounded-lg border-2 border-black px-3 py-2 text-sm font-bold">
                Add variation
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-600">Save the product first, then add its variations.</p>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditorOpen(false)} className="rounded-lg border-2 border-black px-4 py-2 text-sm font-bold">
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || uploading}
              onClick={() => void save()}
              className="rounded-lg border-2 border-black bg-black px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save product'}
            </button>
          </div>
        </div>
      </Modal>

      {deleteConfirm ? (
        <Modal
          isOpen
          onClose={() => !saving && setDeleteConfirm(null)}
          showHeader={false}
          showCloseButton
          maxWidth="sm"
          preventCloseOnOverlayClick={saving}
        >
          <div className="p-6 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
              <AlertTriangle className="h-8 w-8 text-amber-600" aria-hidden />
            </div>
            <h2 className="mb-2 text-xl font-bold text-gray-900">Delete product?</h2>
            <p className="mb-6 text-gray-600">
              This removes <strong className="text-gray-900">{deleteConfirm.label}</strong> and every variation from the House Pros catalog.
            </p>
            <div className="flex justify-center gap-3">
              <Button type="button" variant="secondary" size="sm" onClick={() => setDeleteConfirm(null)} disabled={saving}>
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="border-red-600 bg-red-600 text-white hover:bg-red-700"
                onClick={() => void remove()}
                disabled={saving}
              >
                {saving ? 'Deleting…' : 'Delete'}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {openActionsId && menuPosition && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={actionsMenuRef}
              className="fixed z-[100] min-w-[120px] rounded-md border border-gray-200 bg-white py-1 shadow-lg"
              style={{ top: menuPosition.top, left: menuPosition.left }}
            >
              <button
                type="button"
                className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-100"
                onClick={(event) => {
                  event.stopPropagation();
                  const row = products.find((product) => product.id === openActionsId);
                  setOpenActionsId(null);
                  setMenuPosition(null);
                  if (row) openEdit(row);
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
              <button
                type="button"
                className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-gray-100 hover:text-red-700"
                onClick={(event) => {
                  event.stopPropagation();
                  const row = products.find((product) => product.id === openActionsId);
                  setOpenActionsId(null);
                  setMenuPosition(null);
                  if (row) requestDelete([row.id]);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
