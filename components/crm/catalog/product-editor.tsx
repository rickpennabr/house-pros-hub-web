'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { UNIT_OPTIONS, DEFAULT_UNIT } from '@/lib/constants/unitOptions';
import {
  PRODUCT_IMAGE_LIMIT,
  SUGGESTED_PRODUCT_CATEGORIES,
  SUGGESTED_SPEC_NAMES,
} from '@/lib/crm/catalog-options';
import type { CrmCatalogTerm, CrmProduct } from '@/lib/crm/catalog-types';
import { CentsField } from '@/components/crm/catalog/cents-field';
import { ImageGalleryField, uploadDraftImages, type DraftImage } from '@/components/crm/catalog/image-gallery-field';
import { RememberedCombobox, type RememberedOption } from '@/components/crm/catalog/remembered-combobox';

interface SpecDraft {
  key: string;
  name: string;
  value: string;
}

interface ProductEditorProps {
  open: boolean;
  initial: CrmProduct | null;
  terms: CrmCatalogTerm[];
  onClose: () => void;
  onSaved: (product: CrmProduct) => void;
  onTermsChange: (terms: CrmCatalogTerm[]) => void;
}

function draftsFromProduct(product: CrmProduct | null): DraftImage[] {
  if (!product) return [];
  return [...product.images]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((image) => ({
      key: image.id,
      previewUrl: image.image_url,
      imageUrl: image.image_url,
      storagePath: image.storage_path,
      isThumbnail: image.is_thumbnail,
    }));
}

async function saveTerm(kind: string, label: string): Promise<CrmCatalogTerm> {
  const response = await fetch('/api/crm/catalog-terms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ kind, label, price_mode: null }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Failed to save that name');
  return data.term as CrmCatalogTerm;
}

export function ProductEditor({ open, initial, terms, onClose, onSaved, onTermsChange }: ProductEditorProps) {
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [sku, setSku] = useState('');
  const [upc, setUpc] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState(DEFAULT_UNIT);
  const [priceCents, setPriceCents] = useState(0);
  const [images, setImages] = useState<DraftImage[]>([]);
  const [specs, setSpecs] = useState<SpecDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setBrand(initial?.brand ?? '');
    setSku(initial?.sku ?? '');
    setUpc(initial?.upc ?? '');
    setCategory(initial?.category ?? '');
    setDescription(initial?.description ?? '');
    setUnit(initial?.unit || DEFAULT_UNIT);
    setPriceCents(initial?.price_cents ?? 0);
    setImages(draftsFromProduct(initial));
    setSpecs(
      (initial?.specs ?? []).map((spec) => ({ key: spec.id, name: spec.name, value: spec.value }))
    );
    setError(null);
  }, [open, initial]);

  const categoryOptions = useMemo<RememberedOption[]>(() => {
    const saved = new Map(terms.filter((term) => term.kind === 'product_category').map((term) => [term.label.toLowerCase(), term]));
    const options: RememberedOption[] = SUGGESTED_PRODUCT_CATEGORIES.map((label) => ({
      value: label,
      label,
      group: saved.has(label.toLowerCase()) ? 'Saved' : 'Suggested',
      termId: saved.get(label.toLowerCase())?.id,
    }));
    for (const term of saved.values()) {
      if (!options.some((option) => option.value.toLowerCase() === term.label.toLowerCase())) {
        options.push({ value: term.label, label: term.label, group: 'Saved', termId: term.id });
      }
    }
    return options;
  }, [terms]);

  const unitOptions = useMemo<RememberedOption[]>(() => {
    const builtin = UNIT_OPTIONS.map((option) => ({
      value: option.value,
      label: option.label,
      group: option.group === 'construction' ? 'Construction' : 'General',
    }));
    const custom = terms
      .filter((term) => term.kind === 'unit' && !builtin.some((option) => option.value.toLowerCase() === term.label.toLowerCase()))
      .map((term) => ({ value: term.label, label: term.label, group: 'Saved', termId: term.id }));
    return [...builtin, ...custom];
  }, [terms]);

  const specNameOptions = useMemo<RememberedOption[]>(() => {
    const saved = new Map(terms.filter((term) => term.kind === 'spec_name').map((term) => [term.label.toLowerCase(), term]));
    const options: RememberedOption[] = SUGGESTED_SPEC_NAMES.map((label) => ({
      value: label,
      label,
      group: saved.has(label.toLowerCase()) ? 'Saved' : 'Suggested',
      termId: saved.get(label.toLowerCase())?.id,
    }));
    for (const term of saved.values()) {
      if (!options.some((option) => option.value.toLowerCase() === term.label.toLowerCase())) {
        options.push({ value: term.label, label: term.label, group: 'Saved', termId: term.id });
      }
    }
    return options;
  }, [terms]);

  const addTerm = async (kind: CrmCatalogTerm['kind'], label: string) => {
    const term = await saveTerm(kind, label);
    onTermsChange(terms.some((existing) => existing.id === term.id) ? terms : [...terms, term]);
  };

  const removeTerm = async (option: RememberedOption) => {
    if (!option.termId) return;
    const response = await fetch(`/api/crm/catalog-terms/${option.termId}`, { method: 'DELETE', credentials: 'include' });
    if (!response.ok) return;
    onTermsChange(terms.filter((term) => term.id !== option.termId));
  };

  const save = async () => {
    setError(null);
    if (!name.trim()) {
      setError('Product name is required.');
      return;
    }
    const cleanSpecs = specs
      .map((spec) => ({ name: spec.name.trim(), value: spec.value.trim() }))
      .filter((spec) => spec.name || spec.value);
    if (cleanSpecs.some((spec) => !spec.name || !spec.value)) {
      setError('Each specification needs a name and a value.');
      return;
    }
    setSaving(true);
    try {
      const uploaded = await uploadDraftImages(images, 'products');
      const response = await fetch(initial ? `/api/crm/products/${initial.id}` : '/api/crm/products', {
        method: initial ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: name.trim(),
          brand: brand.trim(),
          sku: sku.trim(),
          upc: upc.trim(),
          category: category.trim(),
          description: description.trim(),
          unit: unit.trim() || DEFAULT_UNIT,
          price_cents: priceCents,
          images: uploaded,
          specs: cleanSpecs,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Failed to save the product');
      onSaved(data.product as CrmProduct);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save the product');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black/40" onClick={onClose} aria-hidden />
      <div className="fixed bottom-0 right-0 top-0 z-[101] flex w-full max-w-xl flex-col overflow-hidden border-l-2 border-black bg-white shadow-xl" role="dialog" aria-labelledby="product-editor-title">
        <div className="flex items-center justify-between border-b-2 border-black p-4">
          <h2 id="product-editor-title" className="text-lg font-bold text-black">{initial ? 'Edit product' : 'New product'}</h2>
          <button type="button" onClick={onClose} className="rounded-lg border-2 border-black p-2" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <ImageGalleryField images={images} max={PRODUCT_IMAGE_LIMIT} onChange={setImages} />
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Product name *</span>
            <Input value={name} onChange={(event) => setName(event.target.value)} className="w-full" placeholder="Holland paver" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Brand</span>
              <Input value={brand} onChange={(event) => setBrand(event.target.value)} className="w-full" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">SKU</span>
              <Input value={sku} onChange={(event) => setSku(event.target.value)} className="w-full" />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">UPC / barcode</span>
            <Input value={upc} onChange={(event) => setUpc(event.target.value)} className="w-full" placeholder="Optional, for a future store" />
          </label>
          <RememberedCombobox
            label="Category"
            value={category}
            onChange={setCategory}
            options={categoryOptions}
            placeholder="Pavers, plants, lighting…"
            onCreate={async (label) => {
              await addTerm('product_category', label);
              setCategory(label);
            }}
            onRemove={removeTerm}
          />
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Description</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              className="w-full resize-y rounded-lg border-2 border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <CentsField label="Price ($)" cents={priceCents} onChange={setPriceCents} />
            <RememberedCombobox
              label="Sold by"
              value={unit}
              onChange={setUnit}
              options={unitOptions}
              onCreate={async (label) => {
                await addTerm('unit', label);
                setUnit(label);
              }}
              onRemove={removeTerm}
              onPick={(option) => setUnit(option.value)}
            />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-gray-700">Specifications</span>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-sm font-medium"
                onClick={() => setSpecs((current) => [...current, { key: crypto.randomUUID(), name: '', value: '' }])}
              >
                <Plus className="h-4 w-4" />
                Add spec
              </button>
            </div>
            <p className="mb-2 text-xs text-gray-500">
              These rows are how one product list holds pavers, plants, and lights. A paver can say Thickness 60 mm. A light can say Wattage 12W. No new columns later.
            </p>
            <div className="space-y-2">
              {specs.map((spec) => (
                <div key={spec.key} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <RememberedCombobox
                    label="Name"
                    value={spec.name}
                    onChange={(value) =>
                      setSpecs((current) => current.map((row) => (row.key === spec.key ? { ...row, name: value } : row)))
                    }
                    options={specNameOptions}
                    onCreate={async (label) => {
                      await addTerm('spec_name', label);
                      setSpecs((current) => current.map((row) => (row.key === spec.key ? { ...row, name: label } : row)));
                    }}
                    onRemove={removeTerm}
                  />
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-gray-700">Value</span>
                    <Input
                      value={spec.value}
                      className="w-full"
                      onChange={(event) =>
                        setSpecs((current) => current.map((row) => (row.key === spec.key ? { ...row, value: event.target.value } : row)))
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="mt-6 h-10 rounded-lg border-2 border-black px-2"
                    aria-label="Remove specification"
                    onClick={() => setSpecs((current) => current.filter((row) => row.key !== spec.key))}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
          {error ? <p className="rounded bg-red-50 p-2 text-sm text-red-600">{error}</p> : null}
        </div>
        <div className="flex justify-end gap-2 border-t-2 border-black p-4">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="button" variant="primary" size="sm" onClick={() => void save()} disabled={saving} loading={saving}>
            {saving ? 'Saving…' : 'Save product'}
          </Button>
        </div>
      </div>
    </>
  );
}
