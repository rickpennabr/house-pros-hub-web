'use client';

import { useCallback, useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import { AdminFloatingAddButton } from '@/components/admin/AdminFloatingAddButton';
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
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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

  const remove = async (id: string) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/products/${id}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Failed to delete product');
      setConfirmDeleteId(null);
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
    <div className="p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-black">Products</h1>
          <p className="mt-1 text-sm text-gray-700">House Pros catalog, including colors, sizes, and thicknesses.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="hidden rounded-lg border-2 border-black bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 md:inline-flex"
        >
          Add product
        </button>
      </div>

      {error && !editorOpen ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-sm text-gray-700">Loading products...</p> : null}
      {!loading && products.length === 0 ? <p className="text-sm text-gray-700">No products yet.</p> : null}

      <ul className="space-y-2">
        {products.map((product) => (
          <li key={product.id} className="flex items-center justify-between gap-3 rounded-lg border-2 border-black bg-white p-3">
            <div className="flex min-w-0 items-center gap-3">
              {product.image_url ? (
                <img src={product.image_url} alt="" className="h-12 w-12 rounded object-cover" />
              ) : (
                <span className="inline-block h-12 w-12 rounded bg-neutral-100" />
              )}
              <div className="min-w-0">
                <p className="truncate font-bold text-black">{product.name}</p>
                <p className="truncate text-sm text-gray-600">
                  {[product.brand, product.product_type, `${product.variants.length} variations`].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <button type="button" onClick={() => openEdit(product)} className="text-sm font-bold text-black hover:text-red-600">
                Edit
              </button>
              <button type="button" onClick={() => setConfirmDeleteId(product.id)} className="text-sm font-bold text-red-600">
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      <AdminFloatingAddButton onClick={openCreate} ariaLabel="Add product" />

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

      <Modal isOpen={confirmDeleteId !== null} onClose={() => setConfirmDeleteId(null)} title="Delete product?">
        <p className="text-sm text-gray-700">This removes the product and every variation from the House Pros catalog.</p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => setConfirmDeleteId(null)} className="rounded-lg border-2 border-black px-4 py-2 text-sm font-bold">
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || !confirmDeleteId}
            onClick={() => confirmDeleteId && void remove(confirmDeleteId)}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {saving ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
