'use client';

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { UNIT_OPTIONS, DEFAULT_UNIT } from '@/lib/constants/unitOptions';
import {
  BUILTIN_PRICE_TYPES,
  SUGGESTED_SERVICE_CATEGORIES,
  SERVICE_IMAGE_LIMIT,
  builtinPriceMode,
  type PriceMode,
} from '@/lib/crm/catalog-options';
import type { CrmCatalogTerm, CrmService } from '@/lib/crm/catalog-types';
import { CentsField } from '@/components/crm/catalog/cents-field';
import { ImageGalleryField, uploadDraftImages, type DraftImage } from '@/components/crm/catalog/image-gallery-field';
import { RememberedCombobox, type RememberedOption } from '@/components/crm/catalog/remembered-combobox';

interface ServiceEditorProps {
  open: boolean;
  initial: CrmService | null;
  terms: CrmCatalogTerm[];
  onClose: () => void;
  onSaved: (service: CrmService) => void;
  onTermsChange: (terms: CrmCatalogTerm[]) => void;
}

function draftsFromService(service: CrmService | null): DraftImage[] {
  if (!service) return [];
  return [...service.images]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((image) => ({
      key: image.id,
      previewUrl: image.image_url,
      imageUrl: image.image_url,
      storagePath: image.storage_path,
      isThumbnail: image.is_thumbnail,
    }));
}

async function saveTerm(kind: string, label: string, priceMode?: PriceMode | null): Promise<CrmCatalogTerm> {
  const response = await fetch('/api/crm/catalog-terms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ kind, label, price_mode: priceMode ?? null }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Failed to save that name');
  return data.term as CrmCatalogTerm;
}

export function ServiceEditor({ open, initial, terms, onClose, onSaved, onTermsChange }: ServiceEditorProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState(DEFAULT_UNIT);
  const [priceType, setPriceType] = useState(BUILTIN_PRICE_TYPES[0].label);
  const [priceMode, setPriceMode] = useState<PriceMode>('flat');
  const [priceCents, setPriceCents] = useState(0);
  const [priceMinCents, setPriceMinCents] = useState(0);
  const [priceMaxCents, setPriceMaxCents] = useState(0);
  const [images, setImages] = useState<DraftImage[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setCategory(initial?.category ?? '');
    setDescription(initial?.description ?? '');
    setUnit(initial?.unit || DEFAULT_UNIT);
    setPriceType(initial?.price_type || BUILTIN_PRICE_TYPES[0].label);
    setPriceMode(initial?.price_mode || builtinPriceMode(initial?.price_type || '') || 'flat');
    setPriceCents(initial?.price_cents ?? 0);
    setPriceMinCents(initial?.price_min_cents ?? initial?.price_cents ?? 0);
    setPriceMaxCents(initial?.price_max_cents ?? initial?.price_cents ?? 0);
    setImages(draftsFromService(initial));
    setError(null);
  }, [open, initial]);

  const categoryOptions = useMemo<RememberedOption[]>(() => {
    const saved = new Map(terms.filter((term) => term.kind === 'service_category').map((term) => [term.label.toLowerCase(), term]));
    const options: RememberedOption[] = SUGGESTED_SERVICE_CATEGORIES.map((label) => ({
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

  const priceOptions = useMemo<RememberedOption[]>(() => {
    const builtin = BUILTIN_PRICE_TYPES.map((option) => ({
      value: option.label,
      label: option.label,
      group: 'Standard',
      mode: option.mode,
    }));
    const custom = terms
      .filter((term) => term.kind === 'price_type')
      .filter((term) => !builtin.some((option) => option.value.toLowerCase() === term.label.toLowerCase()))
      .map((term) => ({
        value: term.label,
        label: term.label,
        group: 'Saved',
        termId: term.id,
        mode: term.price_mode ?? 'flat',
      }));
    return [...builtin, ...custom];
  }, [terms]);

  const knownPrice = priceOptions.some(
    (option) => option.value.toLowerCase() === priceType.trim().toLowerCase() || option.label.toLowerCase() === priceType.trim().toLowerCase()
  );

  const addTerm = async (kind: CrmCatalogTerm['kind'], label: string, mode?: PriceMode | null) => {
    const term = await saveTerm(kind, label, mode);
    onTermsChange(terms.some((existing) => existing.id === term.id) ? terms : [...terms, term]);
    return term;
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
      setError('Service name is required.');
      return;
    }
    if (!priceType.trim()) {
      setError('Choose a price type.');
      return;
    }
    if (!knownPrice) {
      setError('Save the new price type and choose whether it uses one price, a unit price, or a from/to range.');
      return;
    }
    setSaving(true);
    try {
      const uploaded = await uploadDraftImages(images, 'services');
      const payload = {
        name: name.trim(),
        category: category.trim(),
        description: description.trim(),
        unit: unit.trim() || DEFAULT_UNIT,
        price_type: priceType.trim(),
        price_mode: priceMode,
        price_cents: priceCents,
        price_min_cents: priceMode === 'range' ? priceMinCents : null,
        price_max_cents: priceMode === 'range' ? priceMaxCents : null,
        images: uploaded,
      };
      const response = await fetch(initial ? `/api/crm/services/${initial.id}` : '/api/crm/services', {
        method: initial ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Failed to save the service');
      onSaved(data.service as CrmService);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save the service');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const unitField = (
    <RememberedCombobox
      label="Unit"
      value={unit}
      onChange={setUnit}
      options={unitOptions}
      placeholder="sq ft, hour, cubic yard…"
      onCreate={async (label) => {
        await addTerm('unit', label);
        setUnit(label);
      }}
      onRemove={removeTerm}
      onPick={(option) => setUnit(option.value)}
    />
  );

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black/40" onClick={onClose} aria-hidden />
      <div className="fixed bottom-0 right-0 top-0 z-[101] flex w-full max-w-xl flex-col overflow-hidden border-l-2 border-black bg-white shadow-xl" role="dialog" aria-labelledby="service-editor-title">
        <div className="flex items-center justify-between border-b-2 border-black p-4">
          <h2 id="service-editor-title" className="text-lg font-bold text-black">{initial ? 'Edit service' : 'New service'}</h2>
          <button type="button" onClick={onClose} className="rounded-lg border-2 border-black p-2" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <ImageGalleryField images={images} max={SERVICE_IMAGE_LIMIT} onChange={setImages} />
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Service name *</span>
            <Input value={name} onChange={(event) => setName(event.target.value)} className="w-full" placeholder="Paver installation" />
          </label>
          <RememberedCombobox
            label="Category"
            value={category}
            onChange={setCategory}
            options={categoryOptions}
            placeholder="Choose or add a category"
            onCreate={async (label) => {
              await addTerm('service_category', label);
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
          {priceMode !== 'unit' ? unitField : null}
          <RememberedCombobox
            label="Price type"
            value={priceType}
            onChange={(value) => {
              setPriceType(value);
              const match = priceOptions.find((option) => option.value.toLowerCase() === value.trim().toLowerCase());
              if (match?.mode) setPriceMode(match.mode);
            }}
            options={priceOptions}
            onPick={(option) => {
              setPriceType(option.value);
              if (option.mode) setPriceMode(option.mode);
            }}
            onRemove={removeTerm}
          />
          {!knownPrice && priceType.trim() ? (
            <div className="rounded-lg border-2 border-black p-3">
              <p className="mb-2 text-sm text-gray-700">Save “{priceType.trim()}” and choose how the price is entered.</p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['flat', 'One price'],
                    ['unit', 'Price per unit'],
                    ['range', 'From / to'],
                  ] as const
                ).map(([mode, label]) => (
                  <Button
                    key={mode}
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      void addTerm('price_type', priceType.trim(), mode).then(() => {
                        setPriceType(priceType.trim());
                        setPriceMode(mode);
                      });
                    }}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
          {priceMode === 'flat' ? <CentsField label="Price ($)" cents={priceCents} onChange={setPriceCents} /> : null}
          {priceMode === 'unit' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <CentsField label="Price ($)" cents={priceCents} onChange={setPriceCents} />
              {unitField}
            </div>
          ) : null}
          {priceMode === 'range' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <CentsField label="From ($)" cents={priceMinCents} onChange={setPriceMinCents} />
              <CentsField label="To ($)" cents={priceMaxCents} onChange={setPriceMaxCents} />
            </div>
          ) : null}
          {error ? <p className="rounded bg-red-50 p-2 text-sm text-red-600">{error}</p> : null}
        </div>
        <div className="flex justify-end gap-2 border-t-2 border-black p-4">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="button" variant="primary" size="sm" onClick={() => void save()} disabled={saving} loading={saving}>
            {saving ? 'Saving…' : 'Save service'}
          </Button>
        </div>
      </div>
    </>
  );
}
