'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import Accordion from '@/components/ui/Accordion';
import { useSingleOpenAccordion } from '@/hooks/useSingleOpenAccordion';
import { UNIT_OPTIONS, DEFAULT_UNIT } from '@/lib/constants/unitOptions';

export interface ProCrmItem {
  id: string;
  name: string;
  item_type: 'service' | 'product';
  sku?: string | null;
  category?: string | null;
  image_url?: string | null;
  description?: string | null;
  price_cents: number;
  unit: string;
  display_order?: number;
}

const ITEM_TYPES = [
  { value: 'service', label: 'Service' },
  { value: 'product', label: 'Product' },
] as const;

const generalUnits = UNIT_OPTIONS.filter((o) => o.group === 'general');
const constructionUnits = UNIT_OPTIONS.filter((o) => o.group === 'construction');

interface AddProductServicePanelProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after saving; pass "saveAndNew" to keep panel open and reset form. */
  onSaved: (item: ProCrmItem, action: 'close' | 'saveAndNew') => void;
  existingItems?: ProCrmItem[];
  initialItem?: ProCrmItem | null;
}

export function AddProductServicePanel({
  isOpen,
  onClose,
  onSaved,
  existingItems = [],
  initialItem = null,
}: AddProductServicePanelProps) {
  const { toggle, isOpen: isAccOpen } = useSingleOpenAccordion(['basic', 'sales'], 'basic');
  const [availableItems, setAvailableItems] = useState<ProCrmItem[]>(existingItems);
  const [selectedExistingId, setSelectedExistingId] = useState('');
  const [showNameMatches, setShowNameMatches] = useState(false);
  const nameFieldRef = useRef<HTMLLabelElement | null>(null);

  const [name, setName] = useState('');
  const [itemType, setItemType] = useState<'service' | 'product'>('service');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [priceCents, setPriceCents] = useState<number>(0);
  const [unit, setUnit] = useState(DEFAULT_UNIT);
  const [unitOther, setUnitOther] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingPriceFocus, setEditingPriceFocus] = useState(false);
  const [editingPriceValue, setEditingPriceValue] = useState('');

  const displayUnit = unit === 'other' ? unitOther.trim() || DEFAULT_UNIT : unit;
  const normalizedNameQuery = name.trim().toLowerCase();
  const nameMatches = useMemo(() => {
    if (!normalizedNameQuery) return [];
    return availableItems
      .filter((item) =>
        item.name.toLowerCase().includes(normalizedNameQuery) ||
        (item.description ?? '').toLowerCase().includes(normalizedNameQuery)
      )
      .slice(0, 8);
  }, [availableItems, normalizedNameQuery]);

  useEffect(() => {
    if (!isOpen) {
      setName('');
      setItemType('service');
      setSku('');
      setCategory('');
      setDescription('');
      setPriceCents(0);
      setUnit(DEFAULT_UNIT);
      setUnitOther('');
      setError(null);
      setEditingPriceFocus(false);
      setSelectedExistingId('');
      setShowNameMatches(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (existingItems.length > 0) {
      setAvailableItems(existingItems);
      return;
    }
    fetch('/api/crm/items', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setAvailableItems(data.items ?? []))
      .catch(() => setAvailableItems([]));
  }, [isOpen, existingItems]);

  useEffect(() => {
    if (!showNameMatches) return;
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!nameFieldRef.current?.contains(target)) {
        setShowNameMatches(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showNameMatches]);

  useEffect(() => {
    if (!isOpen || !initialItem) return;
    applyExistingItemToForm(initialItem);
  }, [isOpen, initialItem]);

  const applyExistingItemToForm = (selected: ProCrmItem) => {
    setSelectedExistingId(selected.id);
    setName(selected.name ?? '');
    setItemType(selected.item_type === 'product' ? 'product' : 'service');
    setSku(selected.sku ?? '');
    setCategory(selected.category ?? '');
    setDescription(selected.description ?? '');
    setPriceCents(selected.price_cents ?? 0);
    const isKnownUnit = UNIT_OPTIONS.some((unitOption) => unitOption.value === (selected.unit ?? ''));
    setUnit(isKnownUnit ? selected.unit : 'other');
    setUnitOther(isKnownUnit ? '' : selected.unit ?? '');
    setShowNameMatches(false);
  };

  const doSubmit = async (action: 'close' | 'saveAndNew') => {
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Name is required.');
      return;
    }
    const normalizedUnit = (displayUnit || DEFAULT_UNIT).trim().toLowerCase();
    const isDuplicate = availableItems.some((item) => {
      if (item.id === selectedExistingId) return false;
      return (
        (item.name ?? '').trim().toLowerCase() === trimmedName.toLowerCase() &&
        item.item_type === itemType &&
        (item.sku ?? '').trim().toLowerCase() === sku.trim().toLowerCase() &&
        (item.category ?? '').trim().toLowerCase() === category.trim().toLowerCase() &&
        (item.description ?? '').trim().toLowerCase() === description.trim().toLowerCase() &&
        (item.price_cents ?? 0) === priceCents &&
        (item.unit ?? '').trim().toLowerCase() === normalizedUnit
      );
    });
    if (isDuplicate) {
      setError('An identical product/service already exists. Update at least one field to keep it unique.');
      return;
    }
    setSubmitting(true);
    try {
      const isEditing = Boolean(selectedExistingId);
      const endpoint = isEditing ? `/api/crm/items/${selectedExistingId}` : '/api/crm/items';
      const method = isEditing ? 'PATCH' : 'POST';
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: trimmedName,
          item_type: itemType,
          sku: sku.trim() || undefined,
          category: category.trim() || undefined,
          description: description.trim() || undefined,
          price_cents: priceCents,
          unit: displayUnit || DEFAULT_UNIT,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      const item = data as ProCrmItem;
      setAvailableItems((prev) => {
        const idx = prev.findIndex((existingItem) => existingItem.id === item.id);
        if (idx === -1) return [...prev, item];
        const next = [...prev];
        next[idx] = item;
        return next;
      });
      onSaved(item, action);
      if (action === 'close') onClose();
      else {
        setName('');
        setItemType('service');
        setSku('');
        setCategory('');
        setDescription('');
        setPriceCents(0);
        setUnit(DEFAULT_UNIT);
        setUnitOther('');
        setSelectedExistingId('');
        setShowNameMatches(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[100] bg-black/40"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="fixed top-0 right-0 bottom-0 z-[101] w-full max-w-md bg-white border-l-2 border-black shadow-xl flex flex-col overflow-hidden"
        role="dialog"
        aria-labelledby="add-product-service-title"
      >
        <div className="flex items-center justify-between p-4 border-b-2 border-black shrink-0">
          <h2 id="add-product-service-title" className="text-lg font-bold text-black">
            {selectedExistingId ? 'Edit product/service' : 'Add a new service'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg border-2 border-black hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-black" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <Accordion
            title="Basic info"
            isOpen={isAccOpen('basic')}
            onToggle={() => toggle('basic')}
            required={true}
            isComplete={!!name.trim()}
          >
            <div className="space-y-3 pt-2">
              <label className="block relative" ref={nameFieldRef}>
                <span className="block text-sm font-medium text-gray-700 mb-1">Name *</span>
                <Input
                  value={name}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    setName(nextValue);
                    setError(null);
                    setShowNameMatches(nextValue.trim().length > 0);
                    if (selectedExistingId) setSelectedExistingId('');
                  }}
                  onFocus={() => setShowNameMatches(name.trim().length > 0)}
                  placeholder="Type name to add or edit existing item"
                  className="w-full"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Start typing to find existing items. Select one to load and edit it.
                </p>
                {selectedExistingId && (
                  <p className="mt-1 text-xs font-medium text-blue-700">
                    Editing existing item
                  </p>
                )}
                {showNameMatches && nameMatches.length > 0 && (
                  <div className="absolute z-[120] left-0 right-0 mt-1 border border-gray-300 rounded-lg bg-white shadow-lg max-h-48 overflow-y-auto py-1">
                    {nameMatches.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => applyExistingItemToForm(item)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 cursor-pointer"
                      >
                        <div className="font-medium text-gray-900">{item.name}</div>
                        <div className="text-xs text-gray-500">
                          {(item.description ?? '').trim() || 'No description'} · ${(item.price_cents / 100).toFixed(2)}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </label>
              <label className="block">
                <span className="block text-sm font-medium text-gray-700 mb-1">Item type</span>
                <Select
                  value={itemType}
                  onChange={(e) => setItemType(e.target.value as 'service' | 'product')}
                  className="w-full"
                >
                  {ITEM_TYPES.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </Select>
              </label>
              <label className="block">
                <span className="block text-sm font-medium text-gray-700 mb-1">SKU</span>
                <Input
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="Optional"
                  className="w-full"
                />
              </label>
              <label className="block">
                <span className="block text-sm font-medium text-gray-700 mb-1">Category</span>
                <Input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Optional"
                  className="w-full"
                />
              </label>
              <div className="text-sm text-gray-500">Add an image (optional) — coming soon</div>
            </div>
          </Accordion>

          <Accordion
            title="Sales"
            isOpen={isAccOpen('sales')}
            onToggle={() => toggle('sales')}
          >
            <div className="space-y-3 pt-2">
              <label className="block">
                <span className="block text-sm font-medium text-gray-700 mb-1">Description</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional"
                  rows={3}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm resize-y focus:outline-none focus:border-black"
                />
              </label>
              <label className="block">
                <span className="block text-sm font-medium text-gray-700 mb-1">Price/rate ($)</span>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={editingPriceFocus ? editingPriceValue : (priceCents ? (priceCents / 100).toFixed(2) : '')}
                  onFocus={() => {
                    setEditingPriceFocus(true);
                    setEditingPriceValue(priceCents ? (priceCents / 100).toFixed(2) : '');
                  }}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setEditingPriceValue(raw);
                    setPriceCents(Math.round(parseFloat(raw || '0') * 100));
                  }}
                  onBlur={() => {
                    setEditingPriceFocus(false);
                    const raw = editingPriceValue.trim();
                    const parsed = raw === '' ? 0 : parseFloat(raw);
                    if (!Number.isNaN(parsed)) setPriceCents(Math.round(parsed * 100));
                  }}
                  placeholder="0.00"
                  className="w-full"
                />
              </label>
              <label className="block">
                <span className="block text-sm font-medium text-gray-700 mb-1">Unit</span>
                <Select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full"
                >
                  <optgroup label="General">
                    {generalUnits.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Construction">
                    {constructionUnits.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </optgroup>
                  <option value="other">Other</option>
                </Select>
                {unit === 'other' && (
                  <Input
                    value={unitOther}
                    onChange={(e) => setUnitOther(e.target.value)}
                    placeholder="e.g. widget, session"
                    className="w-full mt-2"
                  />
                )}
              </label>
            </div>
          </Accordion>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>
          )}
        </div>

        <div className="p-4 border-t-2 border-black flex flex-wrap items-center gap-2 shrink-0">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => doSubmit('saveAndNew')}
            disabled={submitting}
            loading={submitting}
          >
            Save and new
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => doSubmit('close')}
            disabled={submitting}
            loading={submitting}
          >
            Save and close
          </Button>
        </div>
      </div>
    </>
  );
}
